/**
 * Matching a ship to carrier fleet lists. Pure.
 *
 * BY IMO NUMBER ONLY. Never by ship name ("Maersk …" says nothing about who
 * owns or operates a ship: many carrying a line's name are chartered or
 * lease-owned), MMSI, call sign, flag or proximity. A ship whose broadcast IMO
 * is missing, zero or fails the check digit matches nothing.
 */

import { isCarrierStale, isValidImo, type CarrierRecord, type Relationship } from './types';

export interface CarrierMatch {
  carrierId: string;
  relationship: Relationship;
  asOf: string;
  stale: boolean;
}

/** IMO → the shipping-line records that list it. Build once per sample. */
export function buildImoIndex(carriers: CarrierRecord[]): Map<number, CarrierRecord[]> {
  const index = new Map<number, CarrierRecord[]>();
  for (const carrier of carriers) {
    if (carrier.kind !== 'shipping-line') continue;
    for (const imo of carrier.imo) {
      const list = index.get(imo) ?? [];
      if (!list.includes(carrier)) list.push(carrier);
      index.set(imo, list);
    }
  }
  return index;
}

/**
 * Every list the IMO appears in. Two matches are normal: an owner and an
 * operator may both list the same ship, and both are kept.
 */
export function matchCarriers(
  imo: unknown,
  carriers: CarrierRecord[] | Map<number, CarrierRecord[]>,
  now: Date = new Date(),
): CarrierMatch[] {
  if (!isValidImo(imo)) return [];
  const index = carriers instanceof Map ? carriers : buildImoIndex(carriers);
  return (index.get(imo) ?? []).map((carrier) => ({
    carrierId: carrier.id,
    relationship: carrier.relationship,
    asOf: carrier.asOf,
    stale: isCarrierStale(carrier.asOf, now),
  }));
}
