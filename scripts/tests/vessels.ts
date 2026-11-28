/**
 * Regression tests for the per-vessel AIS layer (src/lib/live/vessels.ts,
 * sources/ais.ts, sources/vessels.ts, registry/, app/vessels.json). Run by
 * `npm run test:regressions`. No network: the socket test talks to a mock
 * WebSocket server on 127.0.0.1, written here with node:http alone.
 *
 * The first test matters most. It holds a VERBATIM copy of the accumulator as
 * it was at commit 951df0c, before per-vessel records existed, and proves the
 * chokepoint counts /monitor and /live.json publish are unchanged on the same
 * messages — including when static messages, never subscribed to before, are
 * mixed in.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

import { chokepointContaining, CHOKEPOINTS } from '@/lib/live/nodes';
import { isRecord, num, str } from '@/lib/live/sources/http';

const CANARY = 'CANARY-KEY-7f3a9c1e-do-not-leak';

// ---------------------------------------------------------------------------
// The accumulator as it was at 951df0c. Do not edit: it is the reference.
// ---------------------------------------------------------------------------

const UNDERWAY_KNOTS = 1;

function aisTime(value: unknown): string | null {
  const match = str(value)?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createLegacyAccumulator() {
  const perNode = new Map<string, { mmsi: Set<string>; underway: Set<string>; messages: number }>();
  let latestMessageAt: string | null = null;
  let totalMessages = 0;

  return {
    add(message: unknown): void {
      if (!isRecord(message)) return;
      const meta = isRecord(message.MetaData) ? message.MetaData : null;
      const body = isRecord(message.Message) ? message.Message : null;
      if (!meta) return;

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
      if (sog !== null && sog >= UNDERWAY_KNOTS && sog < 102.2) bucket.underway.add(String(mmsi));
      perNode.set(node.id, bucket);
    },

    summary(sampledAt: string, windowSeconds: number) {
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
      };
    },
  };
}

// ---------------------------------------------------------------------------
// A fixed, awkward message sequence
// ---------------------------------------------------------------------------

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const T0 = Date.parse('2026-11-27T12:00:00Z');
const goTime = (offsetSeconds: number) =>
  `${new Date(T0 + offsetSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19)}.123456 +0000 UTC`;

function positionSequence(): unknown[] {
  const random = seeded(42);
  const messages: unknown[] = [];
  const boxes = CHOKEPOINTS.filter((node) => node.box);
  for (let i = 0; i < 600; i += 1) {
    const node = boxes[Math.floor(random() * boxes.length)];
    const [[south, west], [north, east]] = node.box!;
    const classB = random() < 0.2;
    const type = classB ? 'StandardClassBPositionReport' : 'PositionReport';
    const sogPick = random();
    const sog = sogPick < 0.1 ? 102.3 : sogPick < 0.35 ? random() * 0.9 : 1 + random() * 20;
    // Repeat MMSIs, so distinct-vessel counting is exercised.
    const mmsi = 999_200_000 + Math.floor(random() * 250);
    messages.push({
      MessageType: type,
      Message: { [type]: { Sog: sog, Cog: random() * 360, TrueHeading: random() < 0.1 ? 511 : Math.floor(random() * 360) } },
      MetaData: {
        MMSI: mmsi,
        latitude: south + random() * (north - south),
        longitude: west + random() * (east - west),
        time_utc: goTime(Math.floor(random() * 30)),
      },
    });
  }
  // Out of every box, malformed MMSI, missing time, no body, string numbers, junk.
  messages.push({ MessageType: 'PositionReport', Message: { PositionReport: { Sog: 12 } }, MetaData: { MMSI: 999_200_900, latitude: 30, longitude: -40, time_utc: goTime(1) } });
  messages.push({ MessageType: 'PositionReport', Message: { PositionReport: { Sog: 12 } }, MetaData: { MMSI: 12_345, latitude: 30.6, longitude: 32.4, time_utc: goTime(2) } });
  messages.push({ MessageType: 'PositionReport', Message: { PositionReport: { Sog: 12 } }, MetaData: { MMSI: 999_200_901, latitude: 30.6, longitude: 32.4 } });
  messages.push({ MessageType: 'PositionReport', MetaData: { MMSI: 999_200_902, latitude: 30.6, longitude: 32.4, time_utc: goTime(3) } });
  messages.push({ MetaData: { MMSI: '999200903', latitude: '30.6', longitude: '32.4', time_utc: goTime(4) } });
  messages.push({ MessageType: 'PositionReport', MetaData: { MMSI: 999_200_904, latitude: 95, longitude: 32.4, time_utc: goTime(5) } });
  messages.push('not an object', null, 42, [], { MetaData: 'nope' });
  return messages;
}

function staticSequence(): unknown[] {
  const random = seeded(9);
  const out: unknown[] = [];
  for (let i = 0; i < 80; i += 1) {
    const mmsi = 999_200_000 + Math.floor(random() * 250);
    // Static messages carrying a MetaData position INSIDE a box: the case that
    // would move the counts if statics were counted.
    out.push({
      MessageType: 'ShipStaticData',
      Message: { ShipStaticData: { UserID: mmsi, Valid: true, Name: `[SAMPLE] S${i}`, Type: 70 + (i % 30), CallSign: 'X', ImoNumber: 0 } },
      MetaData: { MMSI: mmsi, latitude: 30.6, longitude: 32.4, time_utc: goTime(i % 30) },
    });
  }
  out.push({
    MessageType: 'StaticDataReport',
    Message: { StaticDataReport: { UserID: 999_200_001, Valid: true, PartNumber: true, ReportB: { Valid: true, ShipType: 37, CallSign: 'B' } } },
    MetaData: { MMSI: 999_200_001, latitude: 50.9, longitude: 1.5, time_utc: goTime(10) },
  });
  return out;
}

function interleave(a: unknown[], b: unknown[]): unknown[] {
  const out: unknown[] = [];
  const step = Math.max(1, Math.floor(a.length / Math.max(1, b.length)));
  let j = 0;
  a.forEach((item, i) => {
    out.push(item);
    if (i % step === 0 && j < b.length) out.push(b[j++]);
  });
  return [...out, ...b.slice(j)];
}

// ---------------------------------------------------------------------------
// A minimal WebSocket server (RFC 6455, text frames only) for the socket test
// ---------------------------------------------------------------------------

function wsFrame(text: string): Buffer {
  const payload = Buffer.from(text);
  const header =
    payload.length < 126
      ? Buffer.from([0x81, payload.length])
      : payload.length < 65_536
        ? Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff])
        : (() => {
            const h = Buffer.alloc(10);
            h[0] = 0x81;
            h[1] = 127;
            h.writeBigUInt64BE(BigInt(payload.length), 2);
            return h;
          })();
  return Buffer.concat([header, payload]);
}

/** The first complete text frame a client sent, unmasked, or null if not yet complete. */
function readClientFrame(buffer: Buffer): string | null {
  if (buffer.length < 2) return null;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  if (buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4);
  const data = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
  for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i % 4];
  return data.toString('utf8');
}

async function mockAisServer(reply: (subscription: string) => unknown[]) {
  const received: string[] = [];
  const sockets = new Set<Socket>();
  const server = http.createServer();
  server.on('upgrade', (request, socket: Socket) => {
    sockets.add(socket);
    const accept = crypto
      .createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    let buffer = Buffer.alloc(0);
    let answered = false;
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const text = answered ? null : readClientFrame(buffer);
      if (text === null) return;
      answered = true;
      received.push(text);
      for (const message of reply(text)) socket.write(wsFrame(JSON.stringify(message)));
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${port}`,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

// ---------------------------------------------------------------------------

async function main() {
  Object.assign(process.env, { NODE_ENV: 'development' });
  delete process.env.VESSEL_STORE;

  const { createAisAccumulator, parseAis, fetchAis, AIS_SUBSCRIBED_MESSAGE_TYPES } = await import('@/lib/live/sources/ais');
  const vessels = await import('@/lib/live/vessels');
  const { buildVesselFeed, vesselCaveats } = await import('@/lib/live/sources/vessels');
  const { createMemoryRegistry, getVesselRegistry } = await import('@/lib/live/registry');

  // --- 1. Counts unchanged ---------------------------------------------------
  const positions = positionSequence();
  const statics = staticSequence();
  const legacy = createLegacyAccumulator();
  for (const message of positions) legacy.add(message);
  const expected = legacy.summary('2026-11-27T12:00:30.000Z', 30);

  const onlyPositions = createAisAccumulator();
  for (const message of positions) onlyPositions.add(message);
  const mixed = createAisAccumulator();
  for (const message of interleave(positions, statics)) mixed.add(message);

  for (const [label, accumulator] of [['positions only', onlyPositions], ['with static messages mixed in', mixed]] as const) {
    const actual = accumulator.summary('2026-11-27T12:00:30.000Z', 30);
    assert.deepEqual(actual.perNode, expected.perNode, label);
    assert.equal(actual.totalMessages, expected.totalMessages, label);
    assert.equal(actual.latestMessageAt, expected.latestMessageAt, label);
    // And the Reading /live.json publishes is identical, field for field.
    assert.deepEqual(parseAis({ ...expected, vessels: actual.vessels }), parseAis(actual), label);
  }
  assert.ok(expected.totalMessages > 500, 'the sequence exercises the counts');
  // The legacy code WOULD have counted static messages with an in-box position: proof the diversion matters.
  const legacyMixed = createLegacyAccumulator();
  for (const message of interleave(positions, statics)) legacyMixed.add(message);
  assert.notEqual(legacyMixed.summary('x', 30).totalMessages, expected.totalMessages);
  console.log('PASS chokepoint counts identical to 951df0c, with and without static messages');

  // The AisData shape /live.json carries has exactly its old keys.
  const reading = parseAis(mixed.summary('2026-11-27T12:00:30.000Z', 30));
  assert.equal(reading.status, 'ok');
  if (reading.status === 'ok') {
    assert.deepEqual(Object.keys(reading.data).sort(), ['chokepoints', 'sampledAt', 'windowSeconds']);
    assert.deepEqual(Object.keys(reading.data.chokepoints[0]).sort(), ['messages', 'nodeId', 'vesselsObserved', 'vesselsUnderway']);
  }
  console.log('PASS /live.json AIS reading shape unchanged');

  // --- 2. Category map ---------------------------------------------------------
  const { shipCategory } = vessels;
  const cases: Array<[number | null, string]> = [
    [null, 'unknown'], [0, 'unknown'], [1, 'unknown'], [19, 'unknown'], [100, 'unknown'], [255, 'unknown'], [-1, 'unknown'], [70.5, 'unknown'],
    [20, 'other'], [29, 'other'],
    [30, 'fishing'],
    [31, 'tug-special'], [32, 'tug-special'], [33, 'tug-special'], [34, 'tug-special'],
    [35, 'military'],
    [36, 'sailing-pleasure'], [37, 'sailing-pleasure'],
    [38, 'unknown'], [39, 'unknown'],
    [40, 'high-speed'], [49, 'high-speed'],
    [50, 'tug-special'], [52, 'tug-special'], [55, 'tug-special'], [58, 'tug-special'], [59, 'tug-special'],
    [60, 'passenger'], [69, 'passenger'],
    [70, 'cargo'], [71, 'cargo'], [74, 'cargo'], [79, 'cargo'],
    [80, 'tanker'], [84, 'tanker'], [89, 'tanker'],
    [90, 'other'], [99, 'other'],
  ];
  for (const [code, category] of cases) assert.equal(shipCategory(code), category, `code ${code}`);
  assert.equal(vessels.normaliseShipType(0), null);
  assert.equal(vessels.normaliseShipType(150), null);
  assert.equal(vessels.normaliseShipType(74), 74);
  console.log('PASS ship-type categories for every code class, junk and reserved as unknown');

  // --- 3. MMSI and flag ------------------------------------------------------
  assert.equal(vessels.normaliseMmsi(999_100_001), '999100001');
  assert.equal(vessels.normaliseMmsi(2_320_001), '002320001', 'coast station: leading zeros restored');
  assert.equal(vessels.normaliseMmsi(12_345), null);
  assert.equal(vessels.normaliseMmsi(1_234_567_890), null);
  assert.equal(vessels.normaliseMmsi(2.5e8 + 0.5), null);
  assert.equal(vessels.normaliseMmsi('12345678a'), null);
  assert.equal(vessels.normaliseMmsi('235000001'), '235000001');
  assert.equal(vessels.shipMid('235000001'), '235');
  assert.equal(vessels.shipMid('002320001'), null, 'coast station MID is not in the first three digits');
  assert.equal(vessels.shipMid('992351234'), null, 'aid to navigation');
  assert.equal(vessels.shipMid('111232001'), null, 'SAR aircraft');
  assert.equal(vessels.shipMid('999100001'), null, 'sample MMSIs are not ship-format');
  assert.equal(vessels.flagFromMmsi('not-an-mmsi'), null);
  assert.equal(vessels.flagFromMmsi(null), null);
  if (vessels.MID_TABLE_SOURCE === null) {
    // The table is not loaded in this build, so no MID resolves: unknown, never a guess.
    assert.equal(vessels.flagFromMmsi('235000001'), null);
  } else {
    const { MID_TABLE } = await import('@/lib/live/mid-table');
    const [mid, country] = Object.entries(MID_TABLE)[0];
    assert.equal(vessels.flagFromMmsi(`${mid}000001`), country, 'known MID');
    assert.equal(vessels.flagFromMmsi('200000001'), MID_TABLE['200'] ?? null, 'MID 200 is unallocated');
  }
  console.log('PASS MMSI validation and flag (from MMSI): known, unknown, non-ship and malformed');

  // --- 4. Sanitiser ----------------------------------------------------------
  const { sanitiseShipText, SHIP_TEXT_MAX } = vessels;
  assert.equal(sanitiseShipText('EVER GIVEN@@@@@@@@@@'), 'EVER GIVEN');
  assert.equal(sanitiseShipText('  MAERSK\u0000\u0007  ALPHA\t\n '), 'MAERSK ALPHA');
  assert.equal(sanitiseShipText('A‮B​C'), 'A B C');
  assert.equal(sanitiseShipText('@@@@'), null);
  assert.equal(sanitiseShipText('   '), null);
  assert.equal(sanitiseShipText(''), null);
  assert.equal(sanitiseShipText(42), null);
  assert.equal(sanitiseShipText(undefined), null);
  const long = sanitiseShipText(`<script>alert(1)</script>\u0007${'X'.repeat(200)}`)!;
  assert.ok(Array.from(long).length <= SHIP_TEXT_MAX);
  assert.ok(!/[\u0000-\u001F\u007F]/.test(long));
  assert.equal(Array.from(sanitiseShipText('🚢'.repeat(60))!).length, SHIP_TEXT_MAX, 'cut on code points');
  console.log('PASS sanitiser: controls, invisible characters, @ padding, length cap, empty');

  // --- 5. Cap and `capped` ---------------------------------------------------
  const sighting = (mmsi: number, nodeId: string, sog: number | null) => ({
    mmsi: String(mmsi), lat: 0, lon: 0, sog, cog: null, heading: null, seenAt: '2026-11-27T12:00:00.000Z', nodeId,
  });
  const many = [
    ...Array.from({ length: 10 }, (_, i) => sighting(999_300_100 + i, 'suez', i % 2 === 0 ? 10 : 0)),
    ...Array.from({ length: 5 }, (_, i) => sighting(999_300_000 + i, 'dover', null)),
  ];
  const perBox = vessels.capSightings(many, 4, 100);
  assert.equal(perBox.capped, 15 - 8);
  const suezKept = perBox.kept.filter((s) => s.nodeId === 'suez').map((s) => s.mmsi);
  assert.deepEqual(suezKept, ['999300100', '999300102', '999300104', '999300106'], 'under way first, then lowest MMSI');
  const total = vessels.capSightings(many, 400, 6);
  assert.equal(total.kept.length, 6);
  assert.equal(total.capped, 9);
  assert.deepEqual(vessels.capSightings(many, 400, 6), total, 'deterministic');
  assert.deepEqual(vessels.capSightings([...many].reverse(), 400, 6).kept, total.kept, 'independent of arrival order');
  const big = Array.from({ length: 2600 }, (_, i) => sighting(999_400_000 + i, CHOKEPOINTS[i % 10].id, 5));
  const defaults = vessels.capSightings(big);
  assert.equal(defaults.kept.length, vessels.VESSELS_TOTAL_CAP);
  assert.equal(defaults.capped, 600);
  for (const node of CHOKEPOINTS) {
    assert.ok(defaults.kept.filter((s) => s.nodeId === node.id).length <= vessels.VESSELS_PER_BOX_CAP);
  }
  console.log('PASS cap: 400 per box, 2,000 total, deterministic, drop count reported');

  // --- 6. Accumulator per-vessel records -------------------------------------
  const sample = mixed.summary('2026-11-27T12:00:30.000Z', 30).vessels;
  assert.ok(sample.sightings.every((s) => /^\d{9}$/.test(s.mmsi)));
  assert.ok(sample.sightings.every((s) => s.sog === null || (s.sog >= 0 && s.sog < 102.2)));
  assert.ok(sample.sightings.every((s) => s.heading === null || (s.heading >= 0 && s.heading < 360)));
  assert.equal(new Set(sample.sightings.map((s) => s.mmsi)).size, sample.sightings.length, 'one sighting per MMSI');
  assert.equal(sample.staticMessages, statics.length);
  assert.ok(sample.dropped.invalidMmsi >= 1 && sample.dropped.noTime >= 1);
  const classB = sample.statics.find((s) => s.mmsi === '999200001');
  assert.ok(classB, 'Class B static recorded');
  console.log('PASS per-vessel sightings validated, one per MMSI, drops counted');

  // --- 7. Registry merge and typeSource --------------------------------------
  const { fixtureAis } = await import('@/lib/live/sources/fixtures');
  const fixture = fixtureAis();
  const registry = createMemoryRegistry();
  await registry.upsert([
    // Registry says tanker; this sample's static says cargo. The sample wins.
    { mmsi: '999100001', name: '[SAMPLE] OLD NAME', imo: null, callsign: null, shipType: 80, staticSeenAt: '2026-11-01T00:00:00.000Z' },
    // No static in this sample: the registry fills the gap.
    { mmsi: '999100002', name: '[SAMPLE] REMEMBERED', imo: null, callsign: null, shipType: 89, staticSeenAt: '2026-11-01T00:00:00.000Z' },
  ]);
  const feed = await buildVesselFeed(fixture, { registry });
  assert.equal(feed.status, 'ok');
  if (feed.status !== 'ok') throw new Error('unreachable');
  const byMmsi = new Map(feed.data.vessels.map((v) => [v.mmsi, v]));
  assert.equal(byMmsi.get('999100001')?.shipType, 70);
  assert.equal(byMmsi.get('999100001')?.typeSource, 'this-sample');
  assert.equal(byMmsi.get('999100001')?.category, 'cargo');
  assert.equal(byMmsi.get('999100001')?.name, '[SAMPLE] NORTHERN ALPHA', '@ padding trimmed');
  assert.equal(byMmsi.get('999100002')?.typeSource, 'registry');
  assert.equal(byMmsi.get('999100002')?.category, 'tanker');
  assert.equal(byMmsi.get('999100003')?.category, 'sailing-pleasure', 'Class B Part B type');
  assert.equal(byMmsi.get('999100003')?.name, '[SAMPLE] SMALL CRAFT', 'Class B Part A name');
  assert.equal(byMmsi.get('999100003')?.heading, null, '511 is not available');
  assert.equal(byMmsi.get('999100004')?.sog, null, '102.3 is not available');
  assert.equal(byMmsi.has('999100005'), false, 'outside every box');
  const hostile = byMmsi.get('999100006')!;
  assert.ok(hostile.name && Array.from(hostile.name).length <= SHIP_TEXT_MAX && !/[\u0000-\u001F]/.test(hostile.name));
  assert.ok(feed.data.vessels.every((v) => v.flag === null || typeof v.flag === 'string'));
  assert.ok(feed.data.vessels.filter((v) => v.mmsi.startsWith('99900')).every((v) => v.typeSource === 'unknown' && v.category === 'unknown'));
  assert.equal(feed.data.typeKnown + feed.data.typeUnknown, feed.data.vessels.length);
  assert.equal(feed.data.typeFromRegistry, 1);
  assert.equal(Object.values(feed.data.byType).reduce((a, b) => a + b, 0), feed.data.vessels.length);
  // Written back: merged, static only. 999100001 now carries this sample's type and name.
  const stored = await registry.lookup(['999100001', '999100006']);
  assert.equal(stored.get('999100001')?.shipType, 70);
  assert.deepEqual(Object.keys(stored.get('999100001')!).sort(), ['callsign', 'imo', 'mmsi', 'name', 'shipType', 'staticSeenAt']);
  // Class B: a later name-only message must not erase a type heard earlier.
  const merged = vessels.mergeStatic(
    { mmsi: '999100003', name: null, imo: null, callsign: 'B', shipType: 37, staticSeenAt: '2026-11-27T12:00:00.000Z' },
    { mmsi: '999100003', name: 'N', imo: null, callsign: null, shipType: null, staticSeenAt: '2026-11-27T12:01:00.000Z' },
  );
  assert.equal(merged.shipType, 37);
  assert.equal(merged.name, 'N');
  // live:check reads without writing.
  const readOnly = createMemoryRegistry();
  await buildVesselFeed(fixture, { registry: readOnly, write: false });
  assert.equal((await readOnly.lookup(['999100001'])).size, 0);
  console.log('PASS registry merge: this sample beats registry, registry fills gaps, typeSource correct, static only');

  // --- 8. Registry failure degrades to "none" --------------------------------
  const broken = {
    name: 'supabase' as const,
    lookup: async () => {
      throw new Error(`connection refused for ${CANARY}`);
    },
    upsert: async () => {
      throw new Error('should not be reached');
    },
  };
  const degraded = await buildVesselFeed(fixture, { registry: broken });
  assert.equal(degraded.status, 'ok');
  if (degraded.status === 'ok') {
    assert.match(degraded.notes.join(' '), /could not be read/);
    assert.equal(degraded.data.typeFromRegistry, 0);
    assert.equal(degraded.data.vessels.find((v) => v.mmsi === '999100001')?.typeSource, 'this-sample');
    assert.ok(!JSON.stringify(degraded).includes(CANARY), 'upstream error text is not echoed');
  }
  const writeBroken = { ...createMemoryRegistry(), upsert: async () => { throw new Error('nope'); } };
  const partly = await buildVesselFeed(fixture, { registry: writeBroken });
  assert.ok(partly.status === 'ok' && /could not be updated/.test(partly.notes.join(' ')));

  process.env.VESSEL_STORE = 'sideways';
  assert.match((await getVesselRegistry()).notes.join(' '), /unrecognised/);
  process.env.VESSEL_STORE = 'supabase'; // no Supabase environment set here
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const unconfigured = await getVesselRegistry();
  assert.equal(unconfigured.registry, null);
  assert.match(unconfigured.notes.join(' '), /not configured correctly/);
  process.env.VESSEL_STORE = 'memory';
  Object.assign(process.env, { NODE_ENV: 'production' });
  assert.equal((await getVesselRegistry()).registry, null, 'memory refused in production');
  Object.assign(process.env, { NODE_ENV: 'development' });
  assert.equal((await getVesselRegistry()).registry?.name, 'memory');
  delete process.env.VESSEL_STORE;
  assert.deepEqual(await getVesselRegistry(), { registry: null, notes: [] });
  console.log('PASS registry failure, misconfiguration and production-memory all degrade to "none" with a note');

  // --- 8b. The MID table generator parses a pasted table, and refuses junk ---
  const { parseMidTable } = await import('../build-mid-table');
  const parsed = parseMidTable('MID\tAllocated to\n201\t[SAMPLE] Country A\n 202   [SAMPLE]  Country B \n999\tOut of range\n201\t[SAMPLE] Other\nnote line\n');
  assert.deepEqual(parsed.table, { '201': '[SAMPLE] Country A', '202': '[SAMPLE] Country B' });
  assert.equal(parsed.ignored, 2);
  assert.equal(parsed.errors.length, 2);
  console.log('PASS MID table generator: parses tab or space rows, refuses out-of-range and conflicting MIDs');

  // --- 9. The feed route is hidden -------------------------------------------
  const { monitorEnabled } = await import('@/config/launch');
  assert.equal(monitorEnabled, false, 'monitorEnabled must stay false in this change');
  const route = await import('@/app/vessels.json/route');
  assert.equal(route.dynamic, 'force-static');
  assert.equal(route.revalidate, 900);
  const response = await route.GET();
  assert.equal(response.status, 404);
  console.log('PASS /vessels.json returns 404 while monitorEnabled is false');

  // --- 10. The key never reaches any output ----------------------------------
  const logged: string[] = [];
  const originals = { log: console.log, warn: console.warn, error: console.error };
  for (const level of ['log', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    };
  }
  try {
    const sent = fixtureMessagesForSocket();
    const server = await mockAisServer(() => sent);
    const summary = await fetchAis(CANARY, server.url, 1);
    const subscription = JSON.parse(server.received[0]);
    assert.equal(subscription.APIKey, CANARY, 'the key goes into the subscription and nowhere else');
    assert.deepEqual(subscription.FilterMessageTypes, AIS_SUBSCRIBED_MESSAGE_TYPES);
    assert.deepEqual(AIS_SUBSCRIBED_MESSAGE_TYPES, ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData', 'StaticDataReport']);
    assert.ok(summary.vessels.sightings.length > 0 && summary.vessels.statics.length > 0, 'round trip through the socket');
    await server.close();

    const refusing = await mockAisServer(() => [{ error: `Api Key Is Not Valid: ${CANARY}` }]);
    const refusal = await fetchAis(CANARY, refusing.url, 1).then(
      () => 'resolved',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    await refusing.close();
    assert.match(refusal, /refused the subscription/);

    const outputs = [
      JSON.stringify(summary),
      JSON.stringify(parseAis(summary)),
      JSON.stringify(await buildVesselFeed(summary, { registry: createMemoryRegistry() })),
      JSON.stringify(vesselCaveats(1)),
      refusal,
      ...logged,
    ];
    for (const output of outputs) assert.ok(!output.includes(CANARY), 'canary key found in output');
  } finally {
    Object.assign(console, originals);
  }
  console.log('PASS canary key: in the subscription only — not in any summary, reading, feed, error or log');
}

/** A handful of position and static messages with current timestamps, for the socket round trip. */
function fixtureMessagesForSocket(): unknown[] {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000000 +0000 UTC';
  return [
    { MessageType: 'PositionReport', Message: { PositionReport: { Sog: 9, Cog: 10, TrueHeading: 12 } }, MetaData: { MMSI: 999_500_001, latitude: 30.6, longitude: 32.4, time_utc: now } },
    { MessageType: 'ShipStaticData', Message: { ShipStaticData: { UserID: 999_500_001, Valid: true, Name: '[SAMPLE] SOCKET', Type: 71, CallSign: 'S', ImoNumber: 0 } }, MetaData: { MMSI: 999_500_001, time_utc: now } },
  ];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
