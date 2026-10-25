/**
 * The indicators layer's public API. Pages import from here; components take
 * the data as props and import labels from './types'.
 *
 * Reads files (via ./sources), so it is server-only by construction: a client
 * component that imported it would drag `node:fs` into the browser bundle.
 */

import { buildScorecard, type Scorecard } from './mancale-scorecard';
import { readLedger } from './sources/ledger-file';
import { readMancale } from './sources/local-file';
import type { MancaleIndex } from './types';

export * from './types';
export { MANCALE_CHOKEPOINTS, MANCALE_METHOD } from './mancale-method';
export { SCORECARD_METHOD, SCORECARD_TESTS } from './mancale-scorecard';
export type { CallStatus, Scorecard, ScorecardCall, ScorecardTestResult, Tally } from './mancale-scorecard';

let cached: Promise<MancaleIndex | null> | null = null;

/** The scored Mancalë Index, or null when no data file has been written yet. */
export function getMancale(): Promise<MancaleIndex | null> {
  cached ??= readMancale();
  return cached;
}

/**
 * The scorecard: the index and the tests of its labels, both computed at build
 * time from the data file and the ledger. Null when there is no data file.
 */
export async function getMancaleScorecard(): Promise<{ index: MancaleIndex; scorecard: Scorecard } | null> {
  const index = await getMancale();
  if (!index) return null;
  const ledger = await readLedger();
  const scorecard = buildScorecard(index, ledger.entries);
  scorecard.warnings.push(...ledger.warnings);
  return { index, scorecard };
}
