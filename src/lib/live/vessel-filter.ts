/**
 * Ships for the panels on /monitor: the compact shape sent to the browser,
 * and the filters applied to it. Pure; safe in a client component.
 *
 * ---------------------------------------------------------------------------
 * WHY A COMPACT SHAPE
 *
 * The panels run as one client component, so every vessel is serialised into
 * the page. At the 2,000-vessel cap a full VesselRecord per ship would be
 * about half a megabyte, so each ship travels as a ShipDot: short keys, the
 * position already projected into its panel (the same project() the
 * coastline was built with), the flag as an index into one shared list, and
 * nothing the panels do not show. No IMO, call sign, destination or anything
 * else from the static message beyond the name and the type category.
 *
 * WHAT IS LEFT OUT ON PURPOSE
 *
 * A ship broadcasting type 35 (military operations) or 55 (law enforcement)
 * travels with no name (`w: 1`). This is a proposed default, awaiting both
 * founders (DECISIONS.md, "Per-ship data on the monitor").
 * ---------------------------------------------------------------------------
 */

import type { CarrierSummary, Relationship } from '@/lib/carriers/types';

import { panelWindow, project } from './panel-geo';
import type { BoundingBox } from './types';
import { SHIP_CATEGORIES, VESSEL_UNDERWAY_KNOTS, type ShipCategory, type VesselRecord } from './vessels';

/** AIS type codes whose name is withheld by default: military operations and law enforcement. */
export const NAME_WITHHELD_TYPES: readonly number[] = [35, 55];

/** One ship, as the panels need it. Optional keys are omitted when absent, to keep the payload small. */
export interface ShipDot {
  /** MMSI. */
  m: string;
  /** Name, sanitised radio text. Absent when not heard or withheld. */
  n?: string;
  /** 1 when the name was withheld (NAME_WITHHELD_TYPES). */
  w?: 1;
  /** Index into SHIP_CATEGORIES. */
  c: number;
  /** Index into ShipsData.flags: "flag (from MMSI)". Absent when unknown. */
  f?: number;
  /** 1 when under way (speed of at least 1 knot reported). */
  u?: 1;
  /** Speed over ground in knots, one decimal. Absent when not reported. */
  s?: number;
  /** Course over ground in whole degrees. Absent when not reported. */
  g?: number;
  /** Position in the panel's user units, rounded to a whole unit (under 2 px at any panel size). */
  x: number;
  y: number;
  /** When the position was heard, from the message's own time: seconds BEFORE ShipsData.t0. */
  t: number;
  /**
   * How the type is known: 1 reported in this sample, 2 from earlier reports.
   * Omitted when not heard (0), and when 2 is implied by `r`. Read it with typeSourceOf().
   */
  k?: 1 | 2;
  /** When k = 2: the UTC day the earlier report was heard, as days since 1970-01-01 (see dayToDate). */
  r?: number;
  /** Carrier fleet lists the ship's broadcast IMO appears in: an index, or indices, into ShipsData.carriers. */
  cr?: number | number[];
}

/** A carrier list that at least one heard ship matched: the words the details card prints. */
export interface ShipCarrier {
  id: string;
  name: string;
  relationship: Relationship;
  asOf: string;
  stale: boolean;
  publisher: string;
  url: string;
}

export interface ShipsData {
  /** The latest position time in the sample, Unix seconds. ShipDot.t counts back from it. */
  t0: number;
  /** Distinct "flag (from MMSI)" values present, sorted. ShipDot.f indexes this. */
  flags: string[];
  /** Carrier lists matched by at least one ship in the sample, by name. ShipDot.cr indexes this. */
  carriers: ShipCarrier[];
  /** Ships per chokepoint id, under way first then lowest MMSI. */
  byNode: Record<string, ShipDot[]>;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const DAY_MS = 86_400_000;

/** When a ship's position was heard, as an ISO time. */
export function heardAt(data: Pick<ShipsData, 't0'>, ship: ShipDot): string {
  return new Date((data.t0 - ship.t) * 1000).toISOString();
}

/** ShipDot.r as YYYY-MM-DD. */
export function dayToDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Turn the feed's records into the compact shape, grouped by chokepoint. */
export function toShipsData(
  records: VesselRecord[],
  boxes: Record<string, BoundingBox>,
  carrierSummaries: CarrierSummary[] = [],
): ShipsData {
  const matchedIds = new Set(records.flatMap((r) => r.carrierIds));
  const carriers: ShipCarrier[] = carrierSummaries
    .filter((c) => matchedIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, relationship: c.relationship, asOf: c.asOf, stale: c.stale, publisher: c.sources[0].publisher, url: c.sources[0].url }));
  const carrierIndex = new Map(carriers.map((c, i) => [c.id, i]));
  const flags = [...new Set(records.map((r) => r.flag).filter((f): f is string => typeof f === 'string'))].sort();
  const flagIndex = new Map(flags.map((flag, index) => [flag, index]));
  const windows = new Map(Object.entries(boxes).map(([id, box]) => [id, panelWindow(id, box)]));
  const byNode: Record<string, ShipDot[]> = {};
  const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const t0 = records.reduce((latest, record) => Math.max(latest, seconds(record.seenAt)), 0);

  for (const record of records) {
    const window = windows.get(record.nodeId);
    if (!window) continue;
    const [x, y] = project(window, record.lat, record.lon);
    const withheld = record.shipType !== null && NAME_WITHHELD_TYPES.includes(record.shipType);
    const dot: ShipDot = {
      m: record.mmsi,
      c: SHIP_CATEGORIES.indexOf(record.category),
      x: Math.round(x),
      y: Math.round(y),
      t: t0 - seconds(record.seenAt),
    };
    if (record.typeSource === 'this-sample') dot.k = 1;
    else if (record.typeSource === 'registry' && !record.staticSeenAt) dot.k = 2;
    if (withheld) dot.w = 1;
    else if (record.name) dot.n = record.name;
    if (record.flag) dot.f = flagIndex.get(record.flag);
    if (record.sog !== null && record.sog >= VESSEL_UNDERWAY_KNOTS) dot.u = 1;
    if (record.sog !== null) dot.s = round1(record.sog);
    if (record.cog !== null) dot.g = Math.round(record.cog) % 360;
    if (record.typeSource === 'registry' && record.staticSeenAt) dot.r = Math.floor(Date.parse(record.staticSeenAt) / DAY_MS);
    const cr = record.carrierIds.map((id) => carrierIndex.get(id)).filter((i): i is number => i !== undefined);
    if (cr.length === 1) dot.cr = cr[0];
    else if (cr.length > 1) dot.cr = cr;
    (byNode[record.nodeId] ??= []).push(dot);
  }
  for (const list of Object.values(byNode)) list.sort(compareShips);
  return { t0, flags, carriers, byNode };
}

/** Under way first, then lowest MMSI: the order tables use, and the cap used. */
export function compareShips(a: ShipDot, b: ShipDot): number {
  return (b.u ?? 0) - (a.u ?? 0) || (a.m < b.m ? -1 : a.m > b.m ? 1 : 0);
}

/** 0 type not heard, 1 reported in this sample, 2 from earlier reports. */
export function typeSourceOf(dot: ShipDot): 0 | 1 | 2 {
  return dot.k ?? (dot.r !== undefined ? 2 : 0);
}

/** The indices into ShipsData.carriers a ship matched; empty when none. */
export function carrierIndicesOf(dot: ShipDot): number[] {
  return dot.cr === undefined ? [] : Array.isArray(dot.cr) ? dot.cr : [dot.cr];
}

export function shipCategoryOf(dot: ShipDot): ShipCategory {
  return SHIP_CATEGORIES[dot.c] ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface ShipFilters {
  category: ShipCategory | 'all';
  underwayOnly: boolean;
  /** A value from ShipsData.flags, or 'all'. */
  flag: string | 'all';
  /** Case-insensitive substring of the name or MMSI. Plain text, never a pattern. */
  search: string;
  /** A carrier id from ShipsData.carriers, 'none' for ships with no match in the lists held, or 'all'. */
  carrier: string | 'all' | 'none';
}

export const NO_FILTERS: ShipFilters = { category: 'all', underwayOnly: false, flag: 'all', search: '', carrier: 'all' };

export function hasFilters(filters: ShipFilters): boolean {
  return (
    filters.category !== 'all' ||
    filters.underwayOnly ||
    filters.flag !== 'all' ||
    filters.search.trim() !== '' ||
    filters.carrier !== 'all'
  );
}

/**
 * The ships that pass every filter, in their original order. `flags` is the
 * list ShipDot.f indexes. Search is a plain substring match (String.includes),
 * so `.`, `*` or `(` in a query are just characters.
 */
export function filterVessels(
  ships: ShipDot[],
  filters: ShipFilters,
  flags: string[],
  carriers: Pick<ShipCarrier, 'id'>[] = [],
): ShipDot[] {
  const query = filters.search.trim().toLowerCase();
  const flagIndex = filters.flag === 'all' ? -1 : flags.indexOf(filters.flag);
  if (filters.flag !== 'all' && flagIndex === -1) return [];
  const carrierIndex =
    filters.carrier === 'all' || filters.carrier === 'none' ? -1 : carriers.findIndex((c) => c.id === filters.carrier);
  if (filters.carrier !== 'all' && filters.carrier !== 'none' && carrierIndex === -1) return [];
  return ships.filter((ship) => {
    if (filters.category !== 'all' && shipCategoryOf(ship) !== filters.category) return false;
    if (filters.underwayOnly && ship.u !== 1) return false;
    if (flagIndex !== -1 && ship.f !== flagIndex) return false;
    if (filters.carrier === 'none' && ship.cr !== undefined) return false;
    if (carrierIndex !== -1 && !carrierIndicesOf(ship).includes(carrierIndex)) return false;
    if (query) {
      const name = ship.n?.toLowerCase() ?? '';
      if (!name.includes(query) && !ship.m.includes(query)) return false;
    }
    return true;
  });
}
