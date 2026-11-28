/**
 * `npm run carriers:import -- <file> --id … --name … --relationship …
 *   --source-url … --publisher … --retrieved YYYY-MM-DD --as-of YYYY-MM-DD
 *   --source-label … --terms-note … [--terms-checked-on YYYY-MM-DD] [--replace]`
 *
 * Turns a fleet list a PERSON saved from the carrier's own published page
 * (CSV with an "imo" column, or JSON: an array of numbers or of objects with
 * an "imo" field) into content/carriers/<id>.json.
 *
 * It makes no network call and never will: fleet lists are not fetched or
 * scraped from code, and never typed from memory. It refuses to run without
 * every flag, validates the result with the same parser the site loads it
 * with (src/lib/carriers/sources/local-files.ts), never overwrites an existing
 * record without --replace, and prints only counts, the invalid values (so the
 * person can check them against the page) and the output path.
 *
 * The procedure, including reading the page's terms first, is in DEPLOY.md,
 * "Loading a carrier's fleet list".
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED = [
  'id',
  'name',
  'relationship',
  'source-url',
  'publisher',
  'retrieved',
  'as-of',
  'source-label',
  'terms-note',
] as const;

export interface ImportResult {
  rows: number;
  valid: number;
  invalid: string[];
  duplicates: number;
  imo: number[];
}

/** One CSV line into cells, honouring double quotes (a quoted comma stays in its cell; a doubled quote is a quote). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Read the "imo" values from a saved CSV or JSON file's text. */
export function readImoColumn(text: string, format: 'csv' | 'json'): string[] {
  if (format === 'json') {
    const data: unknown = JSON.parse(text);
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) =>
      typeof row === 'object' && row !== null ? String((row as Record<string, unknown>).imo ?? '') : String(row),
    );
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];
  const cells = (line: string) => splitCsvLine(line).map((cell) => cell.trim());
  const column = cells(lines[0]).findIndex((header) => header.toLowerCase() === 'imo');
  if (column === -1) throw new Error('The file has no column named "imo".');
  return lines.slice(1).map((line) => cells(line)[column] ?? '');
}

export function tally(values: string[], isValidImo: (value: unknown) => boolean): ImportResult {
  const invalid = values.filter((value) => !isValidImo(value));
  const valid = values.filter((value) => isValidImo(value)).map(Number);
  const imo = [...new Set(valid)];
  return { rows: values.length, valid: valid.length, invalid, duplicates: valid.length - imo.length, imo };
}

export function parseFlags(argv: string[]): { file: string | null; flags: Record<string, string>; replace: boolean; missing: string[] } {
  const flags: Record<string, string> = {};
  let file: string | null = null;
  let replace = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--replace') replace = true;
    else if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1] ?? '';
      i += 1;
    } else if (!file) file = arg;
  }
  const missing = REQUIRED.filter((name) => !flags[name]?.trim());
  return { file, flags, replace, missing };
}

async function main(): Promise<void> {
  const { file, flags, replace, missing } = parseFlags(process.argv.slice(2));
  if (!file || missing.length > 0) {
    console.error(
      `Refused: ${!file ? 'no input file given. ' : ''}${missing.length ? `missing --${missing.join(', --')}.` : ''}\n` +
        'Every flag is required, so a record always says where the list came from. See DEPLOY.md, "Loading a carrier\'s fleet list".',
    );
    process.exitCode = 1;
    return;
  }

  const { isValidImo } = await import('@/lib/carriers/types');
  const { parseCarrier, carriersDirectory } = await import('@/lib/carriers/sources/local-files');

  const format = file.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  const result = tally(readImoColumn(await readFile(file, 'utf8'), format), isValidImo);

  console.log(`Rows: ${result.rows}`);
  console.log(`Valid IMO numbers: ${result.valid}`);
  console.log(`Duplicates collapsed: ${result.duplicates}`);
  console.log(`Invalid (failed the check digit or not seven digits): ${result.invalid.length}`);
  for (const value of result.invalid) console.log(`  invalid: ${JSON.stringify(value)}`);

  const record = {
    id: flags.id,
    name: flags.name,
    kind: 'shipping-line',
    relationship: flags.relationship,
    sourceLabel: flags['source-label'],
    asOf: flags['as-of'],
    retrieved: flags.retrieved,
    sources: [{ url: flags['source-url'], publisher: flags.publisher }],
    termsChecked: { on: flags['terms-checked-on'] || flags.retrieved, note: flags['terms-note'] },
    imo: result.imo,
  };

  const warnings: string[] = [];
  const parsed = parseCarrier(record, `${flags.id}.json`, warnings, new Date().toISOString().slice(0, 10));
  if (!parsed) {
    for (const warning of warnings) console.error(warning);
    process.exitCode = 1;
    return;
  }

  const out = path.join(carriersDirectory(), `${parsed.id}.json`);
  if (existsSync(out) && !replace) {
    console.error(`Refused: ${out} already exists. Pass --replace to overwrite it after reading the diff.`);
    process.exitCode = 1;
    return;
  }
  await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Wrote ${out}. Read it against the carrier's page before committing.`);
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith('import-fleet')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
