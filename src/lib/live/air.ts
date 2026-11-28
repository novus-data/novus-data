/**
 * Aircraft near air-cargo hubs: types, the category table, the callsign
 * designator, and the parser for OpenSky state vectors. Pure; safe anywhere.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CAN SAY, AND WHAT IT CANNOT
 *
 * An aircraft's transponder says where it is, how fast it is going, a
 * callsign the crew set, and sometimes a coarse size category. It says nothing
 * about the operator or the cargo. An operator can only be INFERRED: when a
 * callsign is three letters and then a digit, the three letters are usually an
 * ICAO airline designator, which the FAA lists in Order JO 7340.2. Aircraft
 * are sometimes flown for one airline under another's designator, passenger
 * airlines carry freight, and cargo airlines fly empty. So: never "carrying",
 * never a cargo claim, and an operator only as "callsign begins with …".
 *
 * PRIVACY: an aircraft can point at a private owner. Only an aircraft whose
 * callsign matched an approved operator designator is listed individually;
 * every other aircraft is a count by category, and its icao24 and callsign
 * never leave the server (see AirNodeReading).
 * ---------------------------------------------------------------------------
 *
 * SOURCE for the state-vector layout and the category codes: OpenSky Network's
 * own API client, https://raw.githubusercontent.com/openskynetwork/opensky-api/
 * master/python/opensky_api.py (StateVector), retrieved 28 November 2026. The
 * REST documentation page itself could not be reached from the environment
 * this was written in.
 */

import type { AirNode } from './air-nodes';

export type AircraftCategory = 'light' | 'small' | 'large' | 'heavy' | 'rotorcraft' | 'other' | 'unknown';

export const AIRCRAFT_CATEGORIES: AircraftCategory[] = ['heavy', 'large', 'small', 'light', 'rotorcraft', 'other', 'unknown'];

export const AIRCRAFT_CATEGORY_LABELS: Record<AircraftCategory, string> = {
  heavy: 'Heavy (over 300,000 lb)',
  large: 'Large (75,000 to 300,000 lb)',
  small: 'Small (15,500 to 75,000 lb)',
  light: 'Light (under 15,500 lb)',
  rotorcraft: 'Rotorcraft',
  other: 'Other (glider, balloon, drone, high-performance)',
  unknown: 'Category not reported',
};

/**
 * OpenSky's ADS-B emitter category code to a coarse category. Codes 16 to 20
 * are surface vehicles and obstacles, not aircraft: null, and the parser drops
 * them. 13 is reserved: unknown. Anything out of range: unknown.
 */
export function aircraftCategory(code: unknown): AircraftCategory | null {
  if (typeof code !== 'number' || !Number.isInteger(code)) return 'unknown';
  if (code >= 16 && code <= 20) return null;
  switch (code) {
    case 2:
      return 'light';
    case 3:
      return 'small';
    case 4:
    case 5: // "high vortex large", such as a B-757
      return 'large';
    case 6:
      return 'heavy';
    case 8:
      return 'rotorcraft';
    case 7:
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
    case 15:
      return 'other';
    default:
      return 'unknown'; // 0, 1, 13 and anything else
  }
}

/** A callsign as broadcast: controls stripped, trimmed, at most 8 characters, or null. */
export function sanitiseCallsign(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g, '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * The airline designator a callsign begins with, when it has the usual
 * commercial shape: exactly three letters, then a digit. A registration
 * (N123AB, GABCD) or anything else returns null: no operator is inferred.
 */
export function callsignDesignator(callsign: unknown): string | null {
  const clean = sanitiseCallsign(callsign);
  if (!clean) return null;
  const match = /^([A-Z]{3})\d/.exec(clean);
  return match ? match[1] : null;
}

/** One aircraft heard inside a node's box. Server only: icao24 and callsign never reach a page unless matched. */
export interface AircraftSighting {
  icao24: string;
  callsign: string | null;
  lat: number;
  lon: number;
  onGround: boolean;
  category: AircraftCategory;
  /** ISO 8601, from time_position, or last_contact when OpenSky had no position time (`timeBasis`). */
  seenAt: string;
  timeBasis: 'position' | 'last-contact';
  nodeId: string;
}

export interface ParseResult {
  sightings: AircraftSighting[];
  /** Latest time inside the data, ISO, or null if no aircraft. */
  latest: string | null;
  /** The response's own `time` (when OpenSky produced the states), ISO, or null. */
  responseTime: string | null;
  dropped: { noPosition: number; malformed: number; notAircraft: number; outsideBox: number };
}

const seconds = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 1_000_000_000 ? value : null;
const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Parse one /states/all response for one node. `states` may be null (an empty
 * sky is not an error). Rows with no position, bad values, the wrong shape, or
 * outside the node's box are dropped and counted, never guessed.
 */
export function parseStates(body: unknown, node: AirNode): ParseResult {
  const result: ParseResult = { sightings: [], latest: null, responseTime: null, dropped: { noPosition: 0, malformed: 0, notAircraft: 0, outsideBox: 0 } };
  const responseSeconds = typeof body === 'object' && body !== null ? seconds((body as { time?: unknown }).time) : null;
  if (responseSeconds !== null) result.responseTime = new Date(responseSeconds * 1000).toISOString();
  const states = typeof body === 'object' && body !== null ? (body as { states?: unknown }).states : null;
  if (!Array.isArray(states)) return result;
  const [[south, west], [north, east]] = node.box;

  for (const row of states) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !/^~?[0-9a-f]{6}$/i.test(row[0])) {
      result.dropped.malformed += 1;
      continue;
    }
    const lon = finite(row[5]);
    const lat = finite(row[6]);
    if (lat === null || lon === null) {
      result.dropped.noPosition += 1;
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || typeof row[8] !== 'boolean') {
      result.dropped.malformed += 1;
      continue;
    }
    if (lat < south || lat > north || lon < west || lon > east) {
      result.dropped.outsideBox += 1;
      continue;
    }
    const category = aircraftCategory(row[17]);
    if (category === null) {
      result.dropped.notAircraft += 1;
      continue;
    }
    const position = seconds(row[3]);
    const contact = seconds(row[4]);
    const at = position ?? contact;
    if (at === null) {
      result.dropped.malformed += 1;
      continue;
    }
    const seenAt = new Date(at * 1000).toISOString();
    if (!result.latest || seenAt > result.latest) result.latest = seenAt;
    result.sightings.push({
      icao24: row[0].toLowerCase(),
      callsign: sanitiseCallsign(row[1]),
      lat,
      lon,
      onGround: row[8],
      category,
      seenAt,
      timeBasis: position !== null ? 'position' : 'last-contact',
      nodeId: node.id,
    });
  }
  return result;
}

/** A flight listed individually: only because its callsign matched an approved operator designator. */
export interface MatchedFlight {
  callsign: string;
  icao24: string;
  designator: string;
  operatorId: string;
  onGround: boolean;
  category: AircraftCategory;
  seenAt: string;
}

/** What a page may show about one node. Unmatched aircraft appear only as counts. */
export interface AirNodeReading {
  nodeId: string;
  airborne: Record<AircraftCategory, number>;
  onGround: Record<AircraftCategory, number>;
  total: number;
  matched: MatchedFlight[];
}

export interface AirOperator {
  id: string;
  name: string;
  designators: string[];
  asOf: string;
  publisher: string;
  url: string;
}

export interface AirData {
  nodes: AirNodeReading[];
  /** Approved operators whose designator matched at least one flight. */
  operators: AirOperator[];
  /** How many approved operator designators are loaded at all. */
  designatorsLoaded: number;
  dropped: ParseResult['dropped'];
}

const zero = () => Object.fromEntries(AIRCRAFT_CATEGORIES.map((c) => [c, 0])) as Record<AircraftCategory, number>;

/** Group sightings into per-node counts, listing only matched flights. */
export function summariseAir(
  nodes: AirNode[],
  sightings: AircraftSighting[],
  operators: { id: string; designators: string[] }[],
): { nodes: AirNodeReading[]; matchedOperatorIds: Set<string> } {
  const byDesignator = new Map<string, string>();
  for (const operator of operators) for (const d of operator.designators) byDesignator.set(d, operator.id);
  const matchedOperatorIds = new Set<string>();

  const readings = nodes.map((node) => {
    const here = sightings.filter((s) => s.nodeId === node.id);
    const reading: AirNodeReading = { nodeId: node.id, airborne: zero(), onGround: zero(), total: here.length, matched: [] };
    for (const s of here) {
      (s.onGround ? reading.onGround : reading.airborne)[s.category] += 1;
      const designator = callsignDesignator(s.callsign);
      const operatorId = designator ? byDesignator.get(designator) : undefined;
      if (designator && operatorId && s.callsign) {
        matchedOperatorIds.add(operatorId);
        reading.matched.push({ callsign: s.callsign, icao24: s.icao24, designator, operatorId, onGround: s.onGround, category: s.category, seenAt: s.seenAt });
      }
    }
    reading.matched.sort((a, b) => a.callsign.localeCompare(b.callsign));
    return reading;
  });
  return { nodes: readings, matchedOperatorIds };
}
