/**
 * The public API for carrier fleet lists. SERVER ONLY (reads files).
 * Components import types and labels from ./types instead.
 */

import { readFromActiveSource } from './sources';
import { summariseCarrier, type CarrierRecord, type CarrierSummary } from './types';

export * from './types';
export { buildImoIndex, matchCarriers, type CarrierMatch } from './match';

/** Every list that passed validation, and the warnings raised loading them. */
export async function listCarriers(): Promise<{ carriers: CarrierRecord[]; warnings: string[] }> {
  return readFromActiveSource();
}

export async function listCarrierSummaries(now: Date = new Date()): Promise<CarrierSummary[]> {
  return (await listCarriers()).carriers.map((carrier) => summariseCarrier(carrier, now));
}
