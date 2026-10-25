/**
 * Reads the Mancalë ledger, `content/indicators/mancale-ledger.json`.
 *
 * The file is written by `npm run mancale`, one entry per refresh, and holds
 * only the label each chokepoint had that week (never a score). A missing file
 * is not an error: it means nothing has been recorded yet, and the scorecard
 * says so. A bad entry warns and is refused, like every other layer here.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseLedger, type LedgerEntry } from '../mancale-scorecard';

export const LEDGER_FILE = path.join(process.cwd(), 'content', 'indicators', 'mancale-ledger.json');

export async function readLedger(): Promise<{ entries: LedgerEntry[]; warnings: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(LEDGER_FILE, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], warnings: [] };
    const warning = `The ledger could not be read: ${(error as Error).message}`;
    console.warn(`[indicators] ${warning}`);
    return { entries: [], warnings: [warning] };
  }
  const result = parseLedger(raw);
  for (const warning of result.warnings) console.warn(`[indicators] ${warning}`);
  return result;
}
