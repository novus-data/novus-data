/**
 * The indicators layer's public API. Pages import from here; components take
 * the data as props and import labels from './types'.
 *
 * Reads files (via ./sources), so it is server-only by construction: a client
 * component that imported it would drag `node:fs` into the browser bundle.
 */

import { readMancale } from './sources/local-file';
import type { MancaleIndex } from './types';

export * from './types';
export { MANCALE_CHOKEPOINTS, MANCALE_METHOD } from './mancale-method';

let cached: Promise<MancaleIndex | null> | null = null;

/** The scored Mancalë Index, or null when no data file has been written yet. */
export function getMancale(): Promise<MancaleIndex | null> {
  cached ??= readMancale();
  return cached;
}
