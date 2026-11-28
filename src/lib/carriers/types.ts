/**
 * Carrier fleet lists — types, labels and the IMO check. Pure; safe anywhere,
 * including client components (import from here, never from ./index.ts, which
 * reads files: CLAUDE.md §6a explains why for the register, and it holds here).
 *
 * ---------------------------------------------------------------------------
 * WHAT A CARRIER RECORD IS, AND WHAT IT IS NOT
 *
 * A record is a carrier's OWN published list of ships, loaded by a person from
 * the carrier's own page (scripts/import-fleet.ts), with the page, the
 * publisher, the dates and a note that its terms were read. Nothing in this
 * repository is a fleet list typed from memory or taken from a commercial
 * vessel database, Wikipedia or a tracking site.
 *
 * A match says one narrow thing: "this ship broadcasts an IMO number that
 * appears in this carrier's published list, dated X". It is not an exposure
 * claim, it says nothing about cargo (a line carries other firms' cargo), and
 * it is never joined to the register by company (CLAUDE.md §6a, "The ships
 * panel"; DECISIONS.md, "Per-ship data on the monitor").
 * ---------------------------------------------------------------------------
 */

export const CARRIER_KINDS = ['shipping-line', 'air-operator'] as const;
export type CarrierKind = (typeof CARRIER_KINDS)[number];

/**
 * The relationship the SOURCE states between the carrier and the ships on its
 * list, in the source's own terms. `listed` when the page does not say.
 */
export const RELATIONSHIPS = ['owned', 'operated', 'managed', 'chartered-in', 'listed'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  owned: 'owned',
  operated: 'operated',
  managed: 'managed',
  'chartered-in': 'chartered in',
  listed: 'listed, relationship not stated',
};

/**
 * A fleet list older than this at build time is marked as not refreshed.
 * PROPOSED DEFAULT, awaiting both founders: fleets change slowly, but ships
 * are bought, sold and delivered every month.
 */
export const CARRIER_STALE_AFTER_DAYS = 90;

/** Same rule as the register's ids: lowercase, digits, single hyphens. */
export const CARRIER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An airline's three-letter ICAO designator, as listed in FAA Order JO 7340.2. */
export const DESIGNATOR_PATTERN = /^[A-Z]{3}$/;

export interface CarrierSource {
  url: string;
  publisher: string;
}

export interface CarrierRecord {
  id: string;
  /** Exactly as the source writes it. Never shortened, never merged with another company sharing a brand. */
  name: string;
  kind: CarrierKind;
  relationship: Relationship;
  /** The heading or label on the page where the list sits, so a reader can find it. */
  sourceLabel: string;
  /** When the list was true or published, YYYY-MM-DD. */
  asOf: string;
  /** When it was saved from the page, YYYY-MM-DD. */
  retrieved: string;
  sources: CarrierSource[];
  /** When a person read the page's terms, and what they found. */
  termsChecked: { on: string; note: string };
  /** Ships: valid IMO numbers, deduplicated. Empty for an air operator. */
  imo: number[];
  /** Air operators: three-letter designators. Empty for a shipping line. */
  designators: string[];
}

/** What the page shows about a list it holds: everything except the list itself. */
export interface CarrierSummary {
  id: string;
  name: string;
  kind: CarrierKind;
  relationship: Relationship;
  sourceLabel: string;
  asOf: string;
  retrieved: string;
  sources: CarrierSource[];
  entries: number;
  /** Older than CARRIER_STALE_AFTER_DAYS when the page was built. */
  stale: boolean;
}

/**
 * Whether a number is a well-formed IMO ship identification number.
 *
 * The IMO ship identification number scheme (IMO Resolution A.1117(30), cited
 * from memory: the resolution could not be re-read from the environment this
 * was written in): seven digits, the last a check digit. Multiply the first six digits
 * by 7, 6, 5, 4, 3 and 2; the last digit of the sum is the check digit.
 * 9074729: 9×7 + 0×6 + 7×5 + 4×4 + 7×3 + 2×2 = 139, so the check digit is 9.
 *
 * This catches typos in imported lists and junk in broadcast IMO fields. It
 * does NOT prove a ship is who it says it is: a valid number can be copied
 * from another ship, and crews type it into the transponder by hand.
 */
export function isValidImo(value: unknown): value is number {
  const n = typeof value === 'string' && /^\d{7}$/.test(value.trim()) ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1_000_000 || n > 9_999_999) return false;
  const digits = String(n).split('').map(Number);
  const sum = digits.slice(0, 6).reduce((total, digit, index) => total + digit * (7 - index), 0);
  return sum % 10 === digits[6];
}

/** Whether a list dated `asOf` was older than the threshold at `now`. Evaluated at build. */
export function isCarrierStale(asOf: string, now: Date = new Date()): boolean {
  const age = (now.getTime() - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000;
  return age > CARRIER_STALE_AFTER_DAYS;
}

export function summariseCarrier(record: CarrierRecord, now: Date = new Date()): CarrierSummary {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    relationship: record.relationship,
    sourceLabel: record.sourceLabel,
    asOf: record.asOf,
    retrieved: record.retrieved,
    sources: record.sources,
    entries: record.kind === 'shipping-line' ? record.imo.length : record.designators.length,
    stale: isCarrierStale(record.asOf, now),
  };
}
