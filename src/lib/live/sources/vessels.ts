/**
 * Turns an AIS sample into the per-vessel feed behind /vessels.json.
 * SERVER ONLY (it reaches the registry).
 *
 * Order of work, each step pure except the registry calls:
 *   1. cap the sightings (deterministic, the drop count reported);
 *   2. look the kept MMSIs up in the registry, if one is configured;
 *   3. merge this sample's static attributes over the registry's and write
 *      them back — static attributes only, never a position;
 *   4. join, categorise and count.
 *
 * A registry failure at step 2 or 3 becomes a note and the feed carries on as
 * if VESSEL_STORE were "none". It never fails the reading.
 */

import { buildImoIndex, listCarriers, summariseCarrier, type CarrierRecord } from '@/lib/carriers';

import { getVesselRegistry, type VesselRegistry } from '../registry';
import type { Reading } from '../types';
import {
  capSightings,
  countByCategory,
  joinVessels,
  mergeStatic,
  MID_TABLE_SOURCE,
  VESSELS_PER_BOX_CAP,
  VESSELS_TOTAL_CAP,
  type VesselFeedData,
  type VesselStatic,
} from '../vessels';
import type { AisSummary } from './ais';

export interface VesselFeedOptions {
  /** Write merged static attributes back to the registry. Off for `live:check`, which only reads. */
  write?: boolean;
  /** A registry to use instead of the one VESSEL_STORE selects. Tests only. */
  registry?: VesselRegistry | null;
  /** Carrier lists to use instead of the active source. Tests only. */
  carriers?: CarrierRecord[];
}

/** The caveats every consumer of the feed must see. Carried in the feed itself, because a file travels without its page. */
export function vesselCaveats(windowSeconds: number): string[] {
  return [
    `Vessels heard by terrestrial receivers during a ${windowSeconds}-second sample. A ship that is not listed may simply not have been heard: absence is not evidence that no ship was there.`,
    'Stationary vessels broadcast only every three minutes, so vessels at anchor or moored are undercounted. This is not a queue length.',
    'Coverage is terrestrial: good near busy coasts, thin offshore. Boxes are not comparable with each other.',
    'Ship type is the coarse AIS type the crew entered. AIS carries no cargo, owner or operator, and nothing here states one. The hazard digit of a type code is not a description of the cargo.',
    'Ship type is known only when the vessel broadcast its static message during this sample or one recorded earlier. Otherwise it is "unknown", never guessed.',
    'Flag (from MMSI) is the country the MMSI was issued in, which usually but not always matches the flag state.',
    'Names and call signs are free text typed by crews, received over radio, and unverified.',
  ];
}

export async function buildVesselFeed(summary: AisSummary, options: VesselFeedOptions = {}): Promise<Reading<VesselFeedData>> {
  const write = options.write ?? true;
  const notes: string[] = [];
  const sample = summary.vessels;

  // 1. Cap.
  const { kept, capped } = capSightings(sample.sightings);

  // 2. Registry lookup.
  let registry: VesselRegistry | null;
  if (options.registry !== undefined) {
    registry = options.registry;
  } else {
    const selected = await getVesselRegistry();
    registry = selected.registry;
    notes.push(...selected.notes);
  }

  const sampleStatics = new Map<string, VesselStatic>(sample.statics.map((s) => [s.mmsi, s]));
  let registryStatics = new Map<string, VesselStatic>();
  if (registry) {
    try {
      const wanted = [...new Set([...kept.map((s) => s.mmsi), ...sampleStatics.keys()])];
      registryStatics = await registry.lookup(wanted);
    } catch {
      notes.push('The vessel registry could not be read, so ship types come from this sample only.');
      registry = null;
    }
  }

  // 3. Write back merged static attributes. Bounded by the sample; idempotent per MMSI.
  if (registry && write && sampleStatics.size > 0) {
    const merged = [...sampleStatics.values()].map((s) => mergeStatic(registryStatics.get(s.mmsi), s));
    try {
      await registry.upsert(merged);
    } catch {
      notes.push('The vessel registry could not be updated. This sample is unaffected.');
    }
  }

  // 4. Join, match to carrier fleet lists BY IMO ONLY, and count.
  let carriers: CarrierRecord[] = options.carriers ?? [];
  if (!options.carriers) {
    try {
      const loaded = await listCarriers();
      carriers = loaded.carriers;
      const refused = loaded.warnings.filter((w) => w.startsWith('Refused')).length;
      if (refused > 0) notes.push(`${refused} carrier fleet list files failed validation and were not used.`);
    } catch {
      notes.push('The carrier fleet lists could not be read, so no ship is matched to one.');
    }
  }
  const imoIndex = buildImoIndex(carriers);
  const joined = joinVessels(kept, sampleStatics, registryStatics);
  for (const record of joined) {
    record.carrierIds = record.imo !== null ? (imoIndex.get(record.imo) ?? []).map((carrier) => carrier.id) : [];
  }
  const vessels = joined.sort(
    (a, b) => a.nodeId.localeCompare(b.nodeId) || (a.mmsi < b.mmsi ? -1 : a.mmsi > b.mmsi ? 1 : 0),
  );
  const typeFromSample = vessels.filter((v) => v.typeSource === 'this-sample').length;
  const typeFromRegistry = vessels.filter((v) => v.typeSource === 'registry').length;

  if (capped > 0) {
    notes.push(
      `${capped} vessels were left out to keep the file small (at most ${VESSELS_PER_BOX_CAP} per box and ${VESSELS_TOTAL_CAP} in all; vessels under way kept first, then lowest MMSI).`,
    );
  }
  const { invalidMmsi, noTime, invalidStatic, overflow } = sample.dropped;
  const droppedTotal = invalidMmsi + noTime + invalidStatic + overflow;
  if (droppedTotal > 0) {
    notes.push(
      `${droppedTotal} messages were left out of the vessel list as malformed (${invalidMmsi} without a nine-digit MMSI, ${noTime} without a readable time, ${invalidStatic} static messages with nothing usable, ${overflow} over the static-record ceiling). The chokepoint counts on /live.json are made separately and unaffected.`,
    );
  }
  if (!MID_TABLE_SOURCE) {
    notes.push('Flag (from MMSI) is not available in this build: the ITU table of Maritime Identification Digits has not been loaded, so every flag is unknown.');
  }
  if (vessels.length === 0) {
    notes.push('No vessel positions were received in any box during this sample. That usually points to the service or receivers, not to empty sea lanes.');
  }

  return {
    status: 'ok',
    source: 'ais',
    // From inside the data, as /live.json does: the latest vessel message received.
    asOf: summary.latestMessageAt ?? summary.sampledAt,
    asOfBasis: summary.latestMessageAt ? 'latest vessel message received' : 'end of sample window',
    data: {
      windowSeconds: summary.windowSeconds,
      sampledAt: summary.sampledAt,
      heard: sample.sightings.length,
      capped,
      staticMessages: sample.staticMessages,
      byType: countByCategory(vessels),
      typeKnown: typeFromSample + typeFromRegistry,
      typeUnknown: vessels.length - typeFromSample - typeFromRegistry,
      typeFromSample,
      typeFromRegistry,
      carriers: carriers.map((carrier) => summariseCarrier(carrier)),
      carrierMatched: vessels.filter((v) => v.carrierIds.length > 0).length,
      vessels,
    },
    // Caveats are not repeated here: /vessels.json carries them as its own
    // top-level `caveats`, from vesselCaveats(). Notes are this sample's own.
    notes,
  };
}
