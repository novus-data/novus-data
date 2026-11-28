/**
 * Reads carrier fleet lists from `content/carriers/*.json`. SERVER ONLY.
 *
 * Same stance as the register's loader (src/lib/disruptions/sources/
 * local-files.ts): a record that cannot be checked does not load. A file
 * missing a required field, with a source that is not a followable http(s)
 * URL, with a future `asOf`, or with no record of its terms being read, is
 * dropped with a warning naming the file — never half-rendered. A single IMO
 * that fails its check digit is dropped and counted; the rest of the list
 * stands. Every warning says whether something was REFUSED or CORRECTED.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { isHttpUrl } from '@/lib/url';
import {
  CARRIER_ID_PATTERN,
  CARRIER_KINDS,
  DESIGNATOR_PATTERN,
  RELATIONSHIPS,
  isValidImo,
  type CarrierKind,
  type CarrierRecord,
  type CarrierSource,
  type Relationship,
} from '../types';

export function carriersDirectory(): string {
  return process.env.NOVUS_CARRIERS_DIR
    ? path.resolve(process.env.NOVUS_CARRIERS_DIR)
    : path.join(process.cwd(), 'content', 'carriers');
}

export interface CarrierRead {
  carriers: CarrierRecord[];
  warnings: string[];
}

function text(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/** A real calendar date written as YYYY-MM-DD, or null. */
function isoDate(raw: unknown): string | null {
  const value = text(raw);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : null;
}

function oneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  const value = text(raw);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Validate one record. `label` names the file in warnings. `today` is the
 * build date (YYYY-MM-DD), so a future date can be refused. Exported for the
 * import script and the tests, so the three cannot disagree.
 */
export function parseCarrier(raw: unknown, label: string, warnings: string[], today: string): CarrierRecord | null {
  const refuse = (why: string) => {
    warnings.push(`Refused ${label}: ${why}`);
    return null;
  };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return refuse('not a JSON object.');
  const r = raw as Record<string, unknown>;

  const id = text(r.id);
  if (!id || !CARRIER_ID_PATTERN.test(id)) return refuse('needs a URL-safe "id".');
  const name = text(r.name);
  if (!name) return refuse('needs a "name", exactly as the source writes it.');
  if (process.env.NODE_ENV === 'production' && name.includes('[SAMPLE]')) {
    return refuse('a [SAMPLE] carrier can never load in a production build.');
  }
  const kind = oneOf<CarrierKind>(r.kind, CARRIER_KINDS);
  if (!kind) return refuse(`"kind" must be one of ${CARRIER_KINDS.join(', ')}.`);
  const relationship = oneOf<Relationship>(r.relationship, RELATIONSHIPS);
  if (!relationship) return refuse(`"relationship" must be one of ${RELATIONSHIPS.join(', ')} (use "listed" when the source does not say).`);
  const sourceLabel = text(r.sourceLabel);
  if (!sourceLabel) return refuse('needs a "sourceLabel": the heading on the page where the list sits.');

  const asOf = isoDate(r.asOf);
  if (!asOf) return refuse('"asOf" must be a real date written YYYY-MM-DD.');
  if (asOf > today) return refuse(`"asOf" ${asOf} is in the future.`);
  const retrieved = isoDate(r.retrieved);
  if (!retrieved) return refuse('"retrieved" must be a real date written YYYY-MM-DD.');
  if (retrieved > today) return refuse(`"retrieved" ${retrieved} is in the future.`);

  const sources: CarrierSource[] = [];
  for (const entry of Array.isArray(r.sources) ? r.sources : []) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const url = text(e.url);
    const publisher = text(e.publisher);
    if (url && publisher && isHttpUrl(url)) sources.push({ url, publisher });
  }
  if (sources.length === 0) return refuse('needs at least one source with a followable http(s) url and a publisher.');

  const terms = (r.termsChecked ?? null) as Record<string, unknown> | null;
  const termsOn = terms ? isoDate(terms.on) : null;
  const termsNote = terms ? text(terms.note) : null;
  if (!termsOn || !termsNote) {
    return refuse('needs "termsChecked" with the date the page\'s terms were read ("on") and what they said ("note").');
  }

  let imo: number[] = [];
  let designators: string[] = [];
  if (kind === 'shipping-line') {
    const rawList = Array.isArray(r.imo) ? r.imo : [];
    const invalid = rawList.filter((value) => !isValidImo(value));
    const valid = rawList.filter(isValidImo).map(Number);
    imo = [...new Set(valid)];
    if (invalid.length > 0) warnings.push(`Corrected ${label}: dropped ${invalid.length} IMO numbers that fail the check digit.`);
    if (valid.length !== imo.length) warnings.push(`Corrected ${label}: collapsed ${valid.length - imo.length} duplicate IMO numbers.`);
    if (imo.length === 0) return refuse('no valid IMO number in "imo".');
  } else {
    const rawList = Array.isArray(r.designators) ? r.designators : [];
    designators = [...new Set(rawList.filter((d): d is string => typeof d === 'string' && DESIGNATOR_PATTERN.test(d)))];
    if (designators.length !== rawList.length) warnings.push(`Corrected ${label}: dropped designators that are not three capital letters, or repeated.`);
    if (designators.length === 0) return refuse('no valid three-letter designator in "designators".');
  }

  return { id, name, kind, relationship, sourceLabel, asOf, retrieved, sources, termsChecked: { on: termsOn, note: termsNote }, imo, designators };
}

export async function readCarriers(today: string = new Date().toISOString().slice(0, 10)): Promise<CarrierRead> {
  const directory = carriersDirectory();
  const warnings: string[] = [];
  let files: string[];
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  } catch {
    return { carriers: [], warnings };
  }

  const carriers: CarrierRecord[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    } catch {
      warnings.push(`Refused ${file}: not valid JSON.`);
      continue;
    }
    const record = parseCarrier(raw, file, warnings, today);
    if (!record) continue;
    if (seen.has(record.id)) {
      warnings.push(`Refused ${file}: the id "${record.id}" is already used by another file.`);
      continue;
    }
    seen.add(record.id);
    carriers.push(record);
  }
  for (const warning of warnings) console.warn(`[carriers] ${warning}`);
  return { carriers, warnings };
}
