/**
 * Air nodes: eight air-cargo hubs, as PLACES, for the hidden air section on
 * /monitor (Vessels Part 3B). Pure data; safe anywhere.
 *
 * Named by place, never by airline: "Memphis", not the carrier based there,
 * for the same reason nodes.ts names straits and not companies. Several of
 * these airports are named after people or firms; the label here is the city.
 *
 * ---------------------------------------------------------------------------
 * SOURCE
 *
 * Coordinates and codes from OurAirports' airports.csv,
 * https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
 * (the project's own GitHub data dump), retrieved 28 November 2026,
 * sha256 fe8548a0c8c63e86…ce00fb, rounded to three decimals. OurAirports
 * describes its data as public domain on https://ourairports.com/data/, which
 * could NOT be reached from the environment this was written in: confirm the
 * licence there before this goes public.
 *
 * Approximate centres and hand-set 0.8° × 0.8° sampling boxes, accurate to a
 * few kilometres. Each box is 0.64 square degrees, far under the 25 square
 * degrees within which, per the handoff, one OpenSky query costs one credit
 * (that figure is unverified here). Receiver coverage differs by region and no
 * sourced note on it was available, so no node carries one.
 * ---------------------------------------------------------------------------
 */

import type { BoundingBox } from './types';

export interface AirNode {
  id: string;
  /** The place, not the airport's commercial or honorific name. */
  name: string;
  iata: string;
  lat: number;
  lon: number;
  /** [[south, west], [north, east]]. */
  box: BoundingBox;
  note?: string;
}

const HALF = 0.4;
const node = (id: string, name: string, iata: string, lat: number, lon: number): AirNode => ({
  id,
  name,
  iata,
  lat,
  lon,
  box: [
    [Math.round((lat - HALF) * 1000) / 1000, Math.round((lon - HALF) * 1000) / 1000],
    [Math.round((lat + HALF) * 1000) / 1000, Math.round((lon + HALF) * 1000) / 1000],
  ],
});

export const AIR_NODES: AirNode[] = [
  node('memphis', 'Memphis', 'MEM', 35.044, -89.976),
  node('louisville', 'Louisville', 'SDF', 38.171, -85.735),
  node('anchorage', 'Anchorage', 'ANC', 61.179, -149.993),
  node('hong-kong', 'Hong Kong', 'HKG', 22.312, 113.915),
  node('shanghai-pudong', 'Shanghai Pudong', 'PVG', 31.143, 121.805),
  node('leipzig-halle', 'Leipzig/Halle', 'LEJ', 51.421, 12.233),
  node('cologne-bonn', 'Cologne/Bonn', 'CGN', 50.866, 7.143),
  node('dubai', 'Dubai', 'DXB', 25.25, 55.371),
];

/** Square degrees of a box. */
export function boxArea([[south, west], [north, east]]: BoundingBox): number {
  return (north - south) * (east - west);
}

export function airNodeContaining(lat: number, lon: number): AirNode | undefined {
  return AIR_NODES.find(({ box: [[s, w], [n, e]] }) => lat >= s && lat <= n && lon >= w && lon <= e);
}
