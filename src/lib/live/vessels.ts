/**
 * Per-vessel records from the AIS sample — types, tables and pure functions.
 *
 * Pure data, no side effects, no network, no environment, no Node-only
 * imports. Safe for a client component, like ./types.ts.
 *
 * ---------------------------------------------------------------------------
 * WHAT AIS CAN AND CANNOT SAY ABOUT A SHIP
 *
 * A vessel's AIS broadcast carries its identity (MMSI), position, speed and
 * course, and — in a separate, less frequent "static" message — a name, a
 * call sign, an IMO number and a coarse ship TYPE typed in by the crew.
 *
 * It carries NO cargo, NO owner and NO operator. The second digit of a type
 * code on 20–99 is a hazardous-cargo CATEGORY (A–D), which says how dangerous
 * a cargo would be, not what is aboard. It is never turned into a cargo claim
 * here, and nothing in this file names a company.
 *
 * Unknown is a valid, displayed state. A ship whose static message was not
 * heard is `unknown`, never guessed from its speed, size or route.
 * ---------------------------------------------------------------------------
 */

import { MID_TABLE, MID_TABLE_SOURCE } from './mid-table';

export { MID_TABLE_SOURCE };

// ---------------------------------------------------------------------------
// Caps on the per-vessel payload
// ---------------------------------------------------------------------------

/** At most this many vessels per chokepoint box in one feed. */
export const VESSELS_PER_BOX_CAP = 400;
/** At most this many vessels in one feed, across every box. */
export const VESSELS_TOTAL_CAP = 2000;

/** Speed over ground at or above which a vessel counts as under way. Matches sources/ais.ts. */
export const VESSEL_UNDERWAY_KNOTS = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One vessel's latest position report heard inside a chokepoint box during the sample. */
export interface VesselSighting {
  /** Nine decimal digits, as a string so leading zeros survive. */
  mmsi: string;
  lat: number;
  lon: number;
  /** Knots, or null when the vessel reported "not available" (102.3) or an out-of-range value. */
  sog: number | null;
  /** Degrees true, or null when "not available" (360) or out of range. */
  cog: number | null;
  /** Degrees true, or null when "not available" (511) or out of range. */
  heading: number | null;
  /** ISO 8601, from the message's own `time_utc` — never from when our code ran. */
  seenAt: string;
  /** Which chokepoint box the position fell in. */
  nodeId: string;
}

/** What a vessel's static message said about it. Attributes only — never a position. */
export interface VesselStatic {
  mmsi: string;
  /** Crew-typed free text, sanitised (sanitiseShipText). Untrusted: never render as HTML. */
  name: string | null;
  /** IMO number, seven digits, or null when absent or not seven digits. */
  imo: number | null;
  callsign: string | null;
  /** AIS ship-type code 1–99, or null when not available (0) or junk (> 99). */
  shipType: number | null;
  /** ISO 8601, the time of the static message the attributes came from. */
  staticSeenAt: string;
}

/** Where a record's ship type came from, so a page can say how it knows. */
export type TypeSource = 'this-sample' | 'registry' | 'unknown';

export type ShipCategory =
  | 'cargo'
  | 'tanker'
  | 'passenger'
  | 'fishing'
  | 'tug-special'
  | 'high-speed'
  | 'sailing-pleasure'
  | 'military'
  | 'other'
  | 'unknown';

export const SHIP_CATEGORIES: ShipCategory[] = [
  'cargo',
  'tanker',
  'passenger',
  'fishing',
  'tug-special',
  'high-speed',
  'sailing-pleasure',
  'military',
  'other',
  'unknown',
];

export const SHIP_CATEGORY_LABELS: Record<ShipCategory, string> = {
  cargo: 'Cargo ship',
  tanker: 'Tanker',
  passenger: 'Passenger ship',
  fishing: 'Fishing vessel',
  'tug-special': 'Tug, pilot or service craft',
  'high-speed': 'High-speed craft',
  'sailing-pleasure': 'Sailing or pleasure craft',
  military: 'Military operations',
  other: 'Other type',
  unknown: 'Type unknown',
};

/** A sighting joined with whatever static data is known about the vessel. */
export interface VesselRecord extends VesselSighting {
  name: string | null;
  imo: number | null;
  callsign: string | null;
  shipType: number | null;
  /** When the static attributes were broadcast, or null when none are known. */
  staticSeenAt: string | null;
  category: ShipCategory;
  /**
   * Country from the MMSI's Maritime Identification Digits — "flag (from
   * MMSI)". See flagFromMmsi for why that is not always the flag state.
   */
  flag: string | null;
  typeSource: TypeSource;
}

// ---------------------------------------------------------------------------
// Ship type → coarse category
// ---------------------------------------------------------------------------

/**
 * AIS "type of ship and cargo type" codes, as defined in ITU-R M.1371.
 *
 * SOURCE: the code table "Codes for Ship Type" in Eric S. Raymond, "AIVDM/AIVDO
 * protocol decoding", v1.58 (24 June 2023), GPSD project, which states it
 * relies only on freely redistributable public documents:
 *   https://gitlab.com/gpsd/gpsd/-/raw/master/www/AIVDM.adoc
 * Retrieved 27 November 2026 (sha256 a55511139751f5b9…3dffbd). The ITU
 * recommendation itself and the US Coast Guard's copy of the table
 * (navcen.uscg.gov) could not be reached from the build environment; check
 * against either before relying on an edge case.
 *
 * The same document notes that values above 99 "are not uncommon in the
 * wild" and should be treated like 0, not available. That is done here.
 *
 * Codes 1–19 are reserved, and 38–39 are reserved: they describe no type, so
 * they map to `unknown`, not to a guess. The hazardous-category digit on
 * 20–99 is ignored for the category and never reported as cargo.
 */
export function shipCategory(code: number | null | undefined): ShipCategory {
  if (code === null || code === undefined || !Number.isInteger(code)) return 'unknown';
  if (code <= 19 || code > 99) return 'unknown'; // 0 not available; 1–19 reserved; > 99 junk
  if (code <= 29) return 'other'; // 20–29 wing in ground
  if (code === 30) return 'fishing';
  if (code >= 31 && code <= 34) return 'tug-special'; // towing, dredging, diving
  if (code === 35) return 'military';
  if (code === 36 || code === 37) return 'sailing-pleasure';
  if (code === 38 || code === 39) return 'unknown'; // reserved
  if (code <= 49) return 'high-speed';
  if (code <= 59) return 'tug-special'; // pilot, SAR, tug, tender, anti-pollution, law enforcement, local, medical, RR Res. 18
  if (code <= 69) return 'passenger';
  if (code <= 79) return 'cargo';
  if (code <= 89) return 'tanker';
  return 'other'; // 90–99
}

/** A type code as broadcast, kept only if it can mean something: 1–99. */
export function normaliseShipType(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 99 ? value : null;
}

// ---------------------------------------------------------------------------
// MMSI and flag
// ---------------------------------------------------------------------------

/**
 * A nine-digit MMSI as a string, or null.
 *
 * Numbers are accepted because AISStream sends MMSI as an integer, so an
 * MMSI with leading zeros (a group, 0MID…, or a coast station, 00MID…)
 * arrives with seven or eight digits and is padded back to nine. Nothing
 * shorter than seven digits is a valid format, so it is refused, as is
 * anything over nine digits or not an integer: a message whose MMSI is not a
 * nine-digit identity is dropped from the per-vessel records.
 */
export function normaliseMmsi(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1_000_000 || value > 999_999_999) return null;
    return String(value).padStart(9, '0');
  }
  if (typeof value === 'string' && /^\d{9}$/.test(value.trim())) return value.trim();
  return null;
}

/**
 * The Maritime Identification Digits of a SHIP-format MMSI, or null.
 *
 * Only a ship station's MMSI starts with its MID (MIDXXXXXX, first digit 2–7).
 * Coast stations (00MID…), groups (0MID…), SAR aircraft (111MID…), aids to
 * navigation (99MID…), craft associated with a parent ship (98MID…) and
 * distress devices (970…, 972…, 974…) put the MID elsewhere or carry none, so
 * reading their first three digits as a country would be wrong. Source: the
 * "MID formats" table in the GPSD AIVDM document cited above, which cites
 * ITU-R M.585.
 */
export function shipMid(mmsi: string): string | null {
  if (!/^[2-7]\d{8}$/.test(mmsi)) return null;
  return mmsi.slice(0, 3);
}

/**
 * MID → country or geographical area, from the ITU's Table of Maritime
 * Identification Digits. EMPTY in this build, deliberately: the ITU list
 * (https://www.itu.int/en/ITU-R/terrestrial/fmd/Pages/mid.aspx) could not be
 * reached from the environment this was written in, and Rule 3 forbids
 * embedding a table that cannot be cited to its source and retrieval date.
 * A list typed from memory would be exactly that.
 *
 * `scripts/build-mid-table.ts` generates ./mid-table.ts from a copy of the
 * ITU page, with its URL and retrieval date. Until it is run, every flag is
 * null, which is shown as unknown. (The table is imported at the top of
 * this file.)
 */
/**
 * "Flag (from MMSI)": the country or area the MMSI's MID is allocated to.
 *
 * A MID records where the MMSI was ISSUED. That usually, but not always,
 * matches the flag state: a ship that re-flags may keep its old MMSI for a
 * while, crews mistype MMSIs, and some vessels broadcast an MMSI that was
 * never allocated. Label this field "flag (from MMSI)" wherever it is shown,
 * never just "flag". Returns null for a MID not in the table, a non-ship
 * MMSI, or a malformed one.
 */
export function flagFromMmsi(mmsi: string | null | undefined): string | null {
  if (typeof mmsi !== 'string') return null;
  const mid = shipMid(mmsi);
  return mid ? (MID_TABLE[mid] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Untrusted text
// ---------------------------------------------------------------------------

/** Longest name, call sign or destination kept. AIS names are at most 20 characters; 40 leaves room for Class B parts. */
export const SHIP_TEXT_MAX = 40;

/**
 * Clean a crew-typed AIS text field: name, call sign or destination.
 *
 * AIS is received over radio from anyone, so this is UNTRUSTED input. This
 * strips control and invisible formatting characters, collapses whitespace,
 * trims the `@` padding AIS uses to fill unused characters, caps the length
 * and returns null if nothing is left. It does NOT make the text safe to
 * insert as HTML or into a URL or query — callers must still escape or encode
 * it (React's text rendering does; `dangerouslySetInnerHTML` must never be
 * used with it).
 */
export function sanitiseShipText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // C0/C1 controls, DEL, zero-width and bidirectional formatting characters.
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/@+$/, '')
    .trim();
  if (cleaned === '') return null;
  // Cap by code point, so a character outside the BMP is never cut in half.
  const capped = Array.from(cleaned).slice(0, SHIP_TEXT_MAX).join('').trim();
  return capped === '' ? null : capped;
}

// ---------------------------------------------------------------------------
// Selection and merge — pure, so the feed and the tests share one copy
// ---------------------------------------------------------------------------

function isUnderway(sighting: VesselSighting): boolean {
  return sighting.sog !== null && sighting.sog >= VESSEL_UNDERWAY_KNOTS;
}

/**
 * Apply the caps deterministically: per box, vessels under way first, then
 * lowest MMSI; then the same order across boxes for the total cap. Returns
 * what was kept and how many were dropped — the count is always reported,
 * never silently lost.
 */
export function capSightings(
  sightings: VesselSighting[],
  perBox = VESSELS_PER_BOX_CAP,
  total = VESSELS_TOTAL_CAP,
): { kept: VesselSighting[]; capped: number } {
  const order = (a: VesselSighting, b: VesselSighting) =>
    Number(isUnderway(b)) - Number(isUnderway(a)) || (a.mmsi < b.mmsi ? -1 : a.mmsi > b.mmsi ? 1 : 0);

  const byBox = new Map<string, VesselSighting[]>();
  for (const sighting of sightings) {
    const list = byBox.get(sighting.nodeId) ?? [];
    list.push(sighting);
    byBox.set(sighting.nodeId, list);
  }
  const withinBoxes = [...byBox.values()].flatMap((list) => [...list].sort(order).slice(0, perBox));
  const kept = withinBoxes.sort(order).slice(0, total);
  return { kept, capped: sightings.length - kept.length };
}

/**
 * Field by field, newer non-null values win. A Class B vessel sends its name
 * and its type in two separate messages, so a later message carrying only a
 * name must not erase a type heard earlier.
 */
export function mergeStatic(older: VesselStatic | undefined, newer: VesselStatic): VesselStatic {
  if (!older) return newer;
  const [first, second] = older.staticSeenAt <= newer.staticSeenAt ? [older, newer] : [newer, older];
  return {
    mmsi: newer.mmsi,
    name: second.name ?? first.name,
    imo: second.imo ?? first.imo,
    callsign: second.callsign ?? first.callsign,
    shipType: second.shipType ?? first.shipType,
    staticSeenAt: second.staticSeenAt,
  };
}

/**
 * Join sightings with static data. Static data heard in this sample beats the
 * registry for each field it carries; the registry fills the gaps. `typeSource`
 * says where the TYPE came from, because that is the field a filter uses.
 */
export function joinVessels(
  sightings: VesselSighting[],
  sampleStatics: Map<string, VesselStatic>,
  registryStatics: Map<string, VesselStatic>,
): VesselRecord[] {
  return sightings.map((sighting) => {
    const fromSample = sampleStatics.get(sighting.mmsi);
    const fromRegistry = registryStatics.get(sighting.mmsi);
    const shipType = fromSample?.shipType ?? fromRegistry?.shipType ?? null;
    const typeSource: TypeSource =
      fromSample?.shipType != null ? 'this-sample' : fromRegistry?.shipType != null ? 'registry' : 'unknown';
    const latestStatic = [fromSample?.staticSeenAt, fromRegistry?.staticSeenAt]
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .pop();
    return {
      ...sighting,
      name: fromSample?.name ?? fromRegistry?.name ?? null,
      imo: fromSample?.imo ?? fromRegistry?.imo ?? null,
      callsign: fromSample?.callsign ?? fromRegistry?.callsign ?? null,
      shipType,
      staticSeenAt: latestStatic ?? null,
      category: shipCategory(shipType),
      flag: flagFromMmsi(sighting.mmsi),
      typeSource,
    };
  });
}

/** Records per category, every category present (zero included), in SHIP_CATEGORIES order. */
export function countByCategory(records: VesselRecord[]): Record<ShipCategory, number> {
  const counts = Object.fromEntries(SHIP_CATEGORIES.map((category) => [category, 0])) as Record<ShipCategory, number>;
  for (const record of records) counts[record.category] += 1;
  return counts;
}

// ---------------------------------------------------------------------------
// The hidden feed's data (the `data` of an ok Reading on /vessels.json)
// ---------------------------------------------------------------------------

export interface VesselFeedData {
  windowSeconds: number;
  /** End of the sample window — when our code stopped listening. Not the data's age; `asOf` is. */
  sampledAt: string;
  /** Distinct vessels with a valid sighting in a box, before the cap. */
  heard: number;
  /** Vessels left out by the cap (VESSELS_PER_BOX_CAP, VESSELS_TOTAL_CAP). Never silently truncated. */
  capped: number;
  /** Static messages received in the sample. */
  staticMessages: number;
  /** Of `vessels`, how many per coarse category, every category listed. */
  byType: Record<ShipCategory, number>;
  /** Of `vessels`, how many have a type, and from where. */
  typeKnown: number;
  typeUnknown: number;
  typeFromSample: number;
  typeFromRegistry: number;
  vessels: VesselRecord[];
}
