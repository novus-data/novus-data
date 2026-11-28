/**
 * AISStream — vessels heard at each chokepoint during a short sample.
 *
 * ---------------------------------------------------------------------------
 * HOW THE NUMBER IS MADE, BECAUSE IT IS EASY TO MISREAD
 *
 * AISStream is a continuous WebSocket of vessel broadcasts. A page cannot hold
 * a socket open between regenerations, so each regeneration opens one,
 * subscribes to every chokepoint's box, listens for AIS_WINDOW_SECONDS, and
 * counts distinct vessels (by MMSI) heard in each box.
 *
 * The headline figure is vessels UNDERWAY — reporting at least 1 knot. That is
 * the robust one: a vessel under way broadcasts every two to ten seconds, so a
 * thirty-second window hears nearly all of them. A vessel at anchor
 * broadcasts only every three minutes, so the same window hears perhaps one in
 * six. The total including stationary vessels is therefore shown, but
 * labelled as an undercount — it is not a queue length.
 *
 * And the caveat that matters most: AISStream is fed by terrestrial receivers.
 * Coverage is good near busy coasts and thin offshore. **A zero means no
 * signal was received, not that no ship was there.** The page prints that
 * beside every zero.
 *
 * ---------------------------------------------------------------------------
 * PER-VESSEL RECORDS (added 27 November 2026, hidden behind /vessels.json)
 *
 * The same sample also keeps, per MMSI, the latest position heard inside a
 * box and any static attributes broadcast (name, call sign, IMO, ship type).
 * They are held in memory for one regeneration and become the hidden feed.
 * Positions are never stored anywhere; only static attributes may go to the
 * optional registry (../registry). The counts are made exactly as before.
 *
 * ---------------------------------------------------------------------------
 * THE KEY
 *
 * AISSTREAM_API_KEY is server-only. It is written into the subscription
 * message and nowhere else: not into a Reading, not into an error, not into
 * anything that can be serialised to the page or to /live.json. The build
 * refuses to run if it is ever prefixed NEXT_PUBLIC_ (assertNoPublicLiveSecrets
 * in input-ledger.ts, added 28 November 2026: the claim was made here before
 * any code enforced it).
 * ---------------------------------------------------------------------------
 */

import { CHOKEPOINTS, chokepointContaining } from '../nodes';
import type { AisData, ChokepointSample, Reading } from '../types';
import {
  mergeStatic,
  normaliseMmsi,
  normaliseShipType,
  sanitiseShipText,
  type VesselSighting,
  type VesselStatic,
} from '../vessels';
import { LiveSourceError, isRecord, num, str } from './http';

const STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const AIS_WINDOW_SECONDS = 30;
const CONNECT_TIMEOUT_MS = 10_000;
const UNDERWAY_KNOTS = 1;

/**
 * The message types subscribed to. The two position types are the ones the
 * counts have always been made from. The two static types (Class A message 5,
 * Class B message 24) were added for the per-vessel feed and carry name, call
 * sign, IMO number and ship type. Field names checked against AISStream's
 * published OpenAPI schema, https://raw.githubusercontent.com/aisstream/
 * ais-message-models/master/type-definition.yaml, retrieved 27 November 2026.
 * That schema leaves MetaData untyped, so whether a static message's MetaData
 * carries a position is NOT known until a real capture is read
 * (`npm run ais:capture`). Nothing here depends on it: static attributes are
 * keyed by MMSI alone.
 */
const POSITION_MESSAGE_TYPES = ['PositionReport', 'StandardClassBPositionReport'] as const;
const STATIC_MESSAGE_TYPES = ['ShipStaticData', 'StaticDataReport'] as const;
export const AIS_SUBSCRIBED_MESSAGE_TYPES = [...POSITION_MESSAGE_TYPES, ...STATIC_MESSAGE_TYPES];

/** A ceiling on static records held in one sample, so a flood of junk MMSIs cannot grow memory without bound. */
const MAX_STATICS_PER_SAMPLE = 20_000;

/**
 * What the sample produced, before it becomes a Reading.
 *
 * `perNode` and the totals are the counts /monitor and /live.json have always
 * shown, made by exactly the same code as before. `vessels` was added for the
 * hidden per-vessel feed (/vessels.json): each vessel's LATEST sighting in a
 * box and whatever static attributes it broadcast. Still no raw messages are
 * kept, and nothing here is ever written anywhere as a position or a track.
 */
export interface AisSummary {
  sampledAt: string;
  windowSeconds: number;
  latestMessageAt: string | null;
  totalMessages: number;
  perNode: Record<string, { vessels: number; underway: number; messages: number }>;
  vessels: AisVesselSample;
}

export interface AisVesselSample {
  /** One per MMSI: the latest valid position report heard inside a box. */
  sightings: VesselSighting[];
  /** One per MMSI: static attributes heard, merged field by field. */
  statics: VesselStatic[];
  /** Static messages received, valid or not. */
  staticMessages: number;
  /** Messages left out of the per-vessel records, by reason. The counts above are unaffected. */
  dropped: {
    /** MMSI missing, or not a nine-digit identity. */
    invalidMmsi: number;
    /** No readable `time_utc`, so no honest age. */
    noTime: number;
    /** A static message AISStream's decoder marked invalid, or with no usable field. */
    invalidStatic: number;
    /** Static records beyond MAX_STATICS_PER_SAMPLE. */
    overflow: number;
  };
}

/** AISStream writes `time_utc` in Go's format: "2026-09-22 17:41:03.318353 +0000 UTC". */
function aisTime(value: unknown): string | null {
  const match = str(value)?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** True for a Class A or Class B static message — these never enter the counts. */
function isStaticMessage(message: Record<string, unknown>, body: Record<string, unknown> | null): boolean {
  const type = str(message.MessageType);
  if (type) return (STATIC_MESSAGE_TYPES as readonly string[]).includes(type);
  return !!body && (isRecord(body.ShipStaticData) || isRecord(body.StaticDataReport));
}

/** A seven-digit IMO number, or null. 0 and junk are "not available". */
function imoNumber(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 1_000_000 && n <= 9_999_999 ? n : null;
}

/**
 * The attributes a static message carries, or null if it carries none.
 * Class B splits them: Part A (PartNumber false) is the name, Part B
 * (PartNumber true) the type and call sign.
 */
function staticAttributes(body: Record<string, unknown> | null): Omit<VesselStatic, 'mmsi' | 'staticSeenAt'> | null {
  if (!body) return null;
  const empty = { name: null, imo: null, callsign: null, shipType: null };
  let attributes: Omit<VesselStatic, 'mmsi' | 'staticSeenAt'> | null = null;

  if (isRecord(body.ShipStaticData)) {
    const report = body.ShipStaticData;
    if (report.Valid === false) return null;
    attributes = {
      name: sanitiseShipText(report.Name),
      imo: imoNumber(report.ImoNumber),
      callsign: sanitiseShipText(report.CallSign),
      shipType: normaliseShipType(num(report.Type)),
    };
  } else if (isRecord(body.StaticDataReport)) {
    const report = body.StaticDataReport;
    if (report.Valid === false) return null;
    if (report.PartNumber === false && isRecord(report.ReportA) && report.ReportA.Valid !== false) {
      attributes = { ...empty, name: sanitiseShipText(report.ReportA.Name) };
    } else if (report.PartNumber === true && isRecord(report.ReportB) && report.ReportB.Valid !== false) {
      attributes = {
        ...empty,
        callsign: sanitiseShipText(report.ReportB.CallSign),
        shipType: normaliseShipType(num(report.ReportB.ShipType)),
      };
    }
  }
  if (!attributes) return null;
  const { name, imo, callsign, shipType } = attributes;
  return name === null && imo === null && callsign === null && shipType === null ? null : attributes;
}

/** A value inside [min, max), else null — for AIS's "not available" sentinels. */
function within(value: number | null, min: number, maxExclusive: number): number | null {
  return value !== null && value >= min && value < maxExclusive ? value : null;
}

/**
 * Counts messages as they arrive. Shared by the live socket and the fixtures,
 * so the fixtures exercise the real bucketing rather than a copy of it.
 *
 * The counting path below is unchanged from before the per-vessel feed. Two
 * things were added around it, and neither can move a count: static messages
 * are diverted BEFORE it (they were never subscribed to before, so counting
 * them would change every number), and the per-vessel sighting is recorded
 * AFTER it. scripts/tests/vessels.ts holds a copy of the old accumulator and
 * proves the counts match on the same messages.
 */
export function createAisAccumulator() {
  const perNode = new Map<string, { mmsi: Set<string>; underway: Set<string>; messages: number }>();
  let latestMessageAt: string | null = null;
  let totalMessages = 0;

  const sightings = new Map<string, VesselSighting>();
  const statics = new Map<string, VesselStatic>();
  let staticMessages = 0;
  const dropped = { invalidMmsi: 0, noTime: 0, invalidStatic: 0, overflow: 0 };

  function addStatic(meta: Record<string, unknown>, body: Record<string, unknown> | null): void {
    staticMessages += 1;
    const report =
      (body && isRecord(body.ShipStaticData) && body.ShipStaticData) ||
      (body && isRecord(body.StaticDataReport) && body.StaticDataReport) ||
      null;
    const mmsi = normaliseMmsi(meta.MMSI) ?? normaliseMmsi(report?.UserID);
    if (!mmsi) {
      dropped.invalidMmsi += 1;
      return;
    }
    const at = aisTime(meta.time_utc);
    if (!at) {
      dropped.noTime += 1;
      return;
    }
    const attributes = staticAttributes(body);
    if (!attributes) {
      dropped.invalidStatic += 1;
      return;
    }
    if (!statics.has(mmsi) && statics.size >= MAX_STATICS_PER_SAMPLE) {
      dropped.overflow += 1;
      return;
    }
    statics.set(mmsi, mergeStatic(statics.get(mmsi), { mmsi, ...attributes, staticSeenAt: at }));
  }

  function addSighting(
    meta: Record<string, unknown>,
    report: Record<string, unknown> | null,
    nodeId: string,
    lat: number,
    lon: number,
  ): void {
    const mmsi = normaliseMmsi(meta.MMSI);
    if (!mmsi) {
      dropped.invalidMmsi += 1;
      return;
    }
    const seenAt = aisTime(meta.time_utc);
    if (!seenAt) {
      dropped.noTime += 1;
      return;
    }
    const heading = report ? num(report.TrueHeading) : null;
    const sighting: VesselSighting = {
      mmsi,
      lat,
      lon,
      // 102.3 is "not available"; 360 and 511 are the same for course and heading.
      sog: within(report ? num(report.Sog) : null, 0, 102.2),
      cog: within(report ? num(report.Cog) : null, 0, 360),
      heading: heading !== null && Number.isInteger(heading) ? within(heading, 0, 360) : null,
      seenAt,
      nodeId,
    };
    const previous = sightings.get(mmsi);
    if (!previous || previous.seenAt <= seenAt) sightings.set(mmsi, sighting);
  }

  return {
    add(message: unknown): void {
      if (!isRecord(message)) return;
      const meta = isRecord(message.MetaData) ? message.MetaData : null;
      const body = isRecord(message.Message) ? message.Message : null;
      if (!meta) return;

      if (isStaticMessage(message, body)) {
        addStatic(meta, body);
        return;
      }

      const lat = num(meta.latitude);
      const lon = num(meta.longitude);
      const mmsi = num(meta.MMSI);
      if (lat === null || lon === null || mmsi === null) return;

      const node = chokepointContaining(lat, lon);
      if (!node) return;

      totalMessages += 1;
      const at = aisTime(meta.time_utc);
      if (at && (!latestMessageAt || at > latestMessageAt)) latestMessageAt = at;

      const report =
        (body && isRecord(body.PositionReport) && body.PositionReport) ||
        (body && isRecord(body.StandardClassBPositionReport) && body.StandardClassBPositionReport) ||
        null;
      const sog = report ? num(report.Sog) : null;

      const bucket = perNode.get(node.id) ?? { mmsi: new Set(), underway: new Set(), messages: 0 };
      bucket.messages += 1;
      bucket.mmsi.add(String(mmsi));
      // 102.3 is AIS's "speed not available" sentinel, not a fast ship.
      if (sog !== null && sog >= UNDERWAY_KNOTS && sog < 102.2) bucket.underway.add(String(mmsi));
      perNode.set(node.id, bucket);

      addSighting(meta, report || null, node.id, lat, lon);
    },

    summary(sampledAt: string, windowSeconds: number): AisSummary {
      return {
        sampledAt,
        windowSeconds,
        latestMessageAt,
        totalMessages,
        perNode: Object.fromEntries(
          [...perNode.entries()].map(([id, bucket]) => [
            id,
            { vessels: bucket.mmsi.size, underway: bucket.underway.size, messages: bucket.messages },
          ]),
        ),
        vessels: {
          sightings: [...sightings.values()],
          statics: [...statics.values()],
          staticMessages,
          dropped: { ...dropped },
        },
      };
    },
  };
}

function decode(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  return null;
}

/** Open the socket, listen for the window, close it. Resolves with counts; rejects with a safe reason. */
/**
 * `url` and `windowSeconds` exist only so the socket logic can be exercised
 * against a local mock server (scripts/tests/vessels.ts); production always
 * uses AISStream and the thirty-second window.
 */
export function fetchAis(
  apiKey: string,
  url: string = STREAM_URL,
  windowSeconds: number = AIS_WINDOW_SECONDS,
): Promise<AisSummary> {
  return new Promise((resolve, reject) => {
    const accumulator = createAisAccumulator();
    let settled = false;
    let windowTimer: ReturnType<typeof setTimeout> | undefined;

    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';

    const finish = (error?: LiveSourceError) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(windowTimer);
      try {
        socket.close();
      } catch {
        // Closing a socket that never opened can throw; nothing to recover.
      }
      if (error) reject(error);
      else resolve(accumulator.summary(new Date().toISOString(), windowSeconds));
    };

    const connectTimer = setTimeout(
      () => finish(new LiveSourceError('AISStream did not accept a connection in time.')),
      CONNECT_TIMEOUT_MS,
    );

    socket.addEventListener('open', () => {
      clearTimeout(connectTimer);
      // AISStream closes a connection that has not subscribed within three
      // seconds, so the subscription goes first and immediately.
      socket.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: CHOKEPOINTS.flatMap((node) => (node.box ? [node.box] : [])),
          FilterMessageTypes: AIS_SUBSCRIBED_MESSAGE_TYPES,
        }),
      );
      windowTimer = setTimeout(() => finish(), windowSeconds * 1000);
    });

    socket.addEventListener('message', (event) => {
      const text = decode(event.data);
      if (!text) return;
      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      // An error object means the subscription was refused — almost always
      // the key. Its text is not echoed.
      if (isRecord(message) && 'error' in message) {
        finish(new LiveSourceError('AISStream refused the subscription. Check that AISSTREAM_API_KEY is valid.'));
        return;
      }
      accumulator.add(message);
    });

    socket.addEventListener('error', () => {
      finish(new LiveSourceError('The connection to AISStream failed.'));
    });

    socket.addEventListener('close', () => {
      // A close before the window elapsed is a failure unless we closed it.
      if (!settled) finish(new LiveSourceError('AISStream closed the connection before the sample finished.'));
    });
  });
}

export function parseAis(summary: AisSummary): Reading<AisData> {
  // Fixed order, never ranked. The page is re-read every fifteen minutes and
  // a reader scans it for change; rows that reshuffle on every update make
  // that impossible, and a ranking would also imply the boxes are comparable,
  // which uneven receiver coverage does not allow.
  const chokepoints: ChokepointSample[] = CHOKEPOINTS.map((node) => {
    const bucket = summary.perNode[node.id];
    return {
      nodeId: node.id,
      vesselsObserved: bucket?.vessels ?? 0,
      vesselsUnderway: bucket?.underway ?? 0,
      messages: bucket?.messages ?? 0,
    };
  });

  const notes = [
    `Vessels heard by terrestrial receivers during a ${summary.windowSeconds}-second sample. A zero means no signal was received, not that no ship was present.`,
    'Stationary vessels broadcast only every three minutes, so the total including them is an undercount, not a queue length.',
  ];
  if (summary.totalMessages === 0) {
    notes.push('No messages were received in any box during this sample. That usually points to the service or receivers, not to empty sea lanes.');
  }

  return {
    status: 'ok',
    source: 'ais',
    // The sample's own end time. It is true regardless of caching: the page
    // that carries it was generated from that sample.
    asOf: summary.latestMessageAt ?? summary.sampledAt,
    asOfBasis: summary.latestMessageAt ? 'latest vessel message received' : 'end of sample window',
    data: { windowSeconds: summary.windowSeconds, sampledAt: summary.sampledAt, chokepoints },
    notes,
  };
}
