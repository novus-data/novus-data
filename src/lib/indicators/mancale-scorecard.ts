/**
 * The Mancalë scorecard. Pure functions and constants, no I/O.
 *
 * The Mancalë Index describes; it does not forecast (the page says so). The
 * scorecard asks the honest follow-up: does a label tell a reader anything
 * about the next four weeks that an ordinary week would not?
 *
 * Two labels lead one score and lag the other. When the label says the ships
 * are ahead of the news, the attention score is the one that is behind; when
 * it says the news is ahead of the ships, flow stress is. So the same question
 * is put to both, by the same rule:
 *
 *   After a week with this label, did the lagging score move toward the
 *   leading one: up by at least `moveBy` points, in any of the next
 *   `horizonWeeks` weeks?
 *
 *   "Ships ahead of news"  (reality-led)   did attention rise?
 *   "News ahead of ships"  (narrative-led) did flow stress rise?
 *
 * WHAT COUNTS AS ONE CALL
 *
 * The first week of a run of the same label. A chokepoint that stays "ships
 * ahead of news" for twenty weeks made one call, not twenty: counting every
 * week would make one long episode look like a sample.
 *
 * WHAT IT IS COMPARED WITH
 *
 * A bare hit rate means nothing without a baseline, and a score that sits at
 * zero rises easily by chance. So each test is also run from every ordinary
 * week, that is every week of a chokepoint with news data in which the score
 * that has to move was below `baselineStartsBelow`. A label is informative
 * only if what follows it differs from that.
 *
 * THREE KINDS OF CALL, KEPT APART
 *
 *   recorded   The label was written to the ledger (content/indicators/
 *              mancale-ledger.json) by `npm run mancale` within
 *              `timelyWithinDays` of the week ending, before the outcome
 *              weeks existed. The only calls that count as a forward test.
 *   history    Found afterwards by scoring the data file. In-sample: the
 *              index's thresholds were chosen looking at this same history,
 *              so a good result here proves little.
 *   revised    Recorded, but the data now scores that week differently
 *              (upstream data was revised). Listed, never counted.
 *
 * The constants below were fixed on 25 October 2026, before any result was
 * computed, and are not to be tuned to a result. A change is a new `version`,
 * and the old results stay under the old one.
 */

import { MANCALE_CHOKEPOINTS, addDays, daysBetween } from './mancale-method';
import { MANCALE_REGIMES, type MancaleChokepoint, type MancaleIndex, type MancaleRegime, type MancaleWeek } from './types';

export const SCORECARD_METHOD = {
  version: '0.1',
  /** Outcome weeks after the call week. */
  horizonWeeks: 4,
  /** A score must rise by at least this much (points on the 0–6 scale) to count as a move. */
  moveBy: 1,
  /** An "ordinary week" is one in which the score that has to move was below this. */
  baselineStartsBelow: 1,
  /** Below this many settled calls a rate is not shown, only the counts. */
  minCallsToRead: 10,
  /** A ledger entry written later than this after the week ended counts as history, not as recorded. */
  timelyWithinDays: 10,
} as const;

export type ScorecardMoves = 'attention' | 'flowStress';

export interface ScorecardTest {
  id: 'ships-ahead' | 'news-ahead';
  /** The label that makes a call. */
  regime: Extract<MancaleRegime, 'reality-led' | 'narrative-led'>;
  /** The lagging score, which has to move toward the leading one. */
  moves: ScorecardMoves;
}

export const SCORECARD_TESTS: readonly ScorecardTest[] = [
  { id: 'ships-ahead', regime: 'reality-led', moves: 'attention' },
  { id: 'news-ahead', regime: 'narrative-led', moves: 'flowStress' },
];

export type CallStatus = 'followed' | 'not-followed' | 'pending';

export interface ScorecardCall {
  testId: ScorecardTest['id'];
  chokepointId: string;
  chokepointLabel: string;
  weekStart: string;
  origin: 'recorded' | 'history';
  /** The day the ledger entry was written. Null for history. */
  recordedOn: string | null;
  status: CallStatus;
  /** How many of the outcome weeks the data has so far. */
  weeksSeen: number;
  /** The largest rise in the moving score seen so far, in points. */
  bestMove: number;
}

export interface Tally {
  /** Calls with an answer: followed, or all outcome weeks seen without it. */
  settled: number;
  followed: number;
  /** Calls still waiting for outcome weeks. */
  pending: number;
  /** followed / settled, only once `settled` reaches minCallsToRead. Otherwise null. */
  rate: number | null;
  /** 95% Wilson interval around `rate`, under the same condition. */
  low: number | null;
  high: number | null;
}

export interface ScorecardTestResult {
  test: ScorecardTest;
  recorded: Tally;
  history: Tally;
  /** The same outcome from every ordinary week. */
  ordinary: Tally;
  calls: ScorecardCall[];
}

export interface ScorecardRevision {
  weekStart: string;
  chokepointId: string;
  chokepointLabel: string;
  recorded: MancaleRegime;
  now: MancaleRegime;
  recordedOn: string;
}

export interface Scorecard {
  version: string;
  /** First week with a timely ledger entry, or null while nothing has been recorded. */
  firstRecordedWeek: string | null;
  recordedWeeks: number;
  /** Ledger entries written too late after their week to count as recorded. */
  lateWeeks: number;
  tests: ScorecardTestResult[];
  revisions: ScorecardRevision[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/** One refresh's record of what the index said that week. Labels only; scores are never stored. */
export interface LedgerEntry {
  /** Monday that opens the week the labels describe. */
  weekStart: string;
  /** The day `npm run mancale` wrote this entry. */
  recordedOn: string;
  methodVersion: string;
  /** Chokepoint id to the label it had that week. */
  regimes: Record<string, MancaleRegime>;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

const KNOWN_IDS = new Set(MANCALE_CHOKEPOINTS.map((point) => point.id));
const KNOWN_REGIMES = new Set<string>(MANCALE_REGIMES);

/**
 * Validate a parsed ledger file. A bad entry is refused with a warning naming
 * it; one bad entry never takes down the build or hides the others. Nothing is
 * ever substituted: a missing label stays missing.
 */
export function parseLedger(raw: unknown): { entries: LedgerEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const file = (raw ?? {}) as Record<string, unknown>;
  if (file.format !== 1 || file.index !== 'mancale-ledger' || !Array.isArray(file.entries)) {
    warnings.push('Refused: the ledger file is not a format-1 Mancalë ledger.');
    return { entries: [], warnings };
  }

  const entries: LedgerEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of file.entries as Record<string, unknown>[]) {
    const weekStart = candidate?.weekStart;
    const recordedOn = candidate?.recordedOn;
    const name = typeof weekStart === 'string' ? weekStart : '(no week)';
    if (!isIsoDay(weekStart) || !isIsoDay(recordedOn)) {
      warnings.push(`Refused: ledger entry ${name} needs a valid weekStart and recordedOn.`);
      continue;
    }
    if (new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1) {
      warnings.push(`Refused: ledger entry ${weekStart} does not start on a Monday.`);
      continue;
    }
    if (daysBetween(addDays(weekStart, 6), recordedOn) < 0) {
      warnings.push(`Refused: ledger entry ${weekStart} was recorded on ${recordedOn}, before that week had ended.`);
      continue;
    }
    if (seen.has(weekStart)) {
      warnings.push(`Refused: ledger entry ${weekStart} appears twice. The first is kept.`);
      continue;
    }
    if (typeof candidate.methodVersion !== 'string' || candidate.methodVersion === '') {
      warnings.push(`Refused: ledger entry ${weekStart} does not say which method version scored it.`);
      continue;
    }
    const regimes: Record<string, MancaleRegime> = {};
    for (const [id, value] of Object.entries((candidate.regimes ?? {}) as Record<string, unknown>)) {
      if (!KNOWN_IDS.has(id) || typeof value !== 'string' || !KNOWN_REGIMES.has(value)) {
        warnings.push(`Corrected: ledger entry ${weekStart} has an unknown chokepoint or label for "${id}"; that value was dropped.`);
        continue;
      }
      regimes[id] = value as MancaleRegime;
    }
    seen.add(weekStart);
    entries.push({ weekStart, recordedOn, methodVersion: candidate.methodVersion, regimes });
  }
  entries.sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  return { entries, warnings };
}

/**
 * What the refresh writes for the latest week: each chokepoint's label, nothing
 * else. A chokepoint whose own latest week is an earlier one is left out,
 * because the ledger must not claim a label for a week that chokepoint has no
 * reading for.
 */
export function nextLedgerEntry(index: MancaleIndex, recordedOn: string): LedgerEntry {
  const regimes: Record<string, MancaleRegime> = {};
  for (const point of index.chokepoints) {
    if (point.latest.weekStart === index.latestWeekStart) regimes[point.id] = point.latest.regime;
  }
  return { weekStart: index.latestWeekStart, recordedOn, methodVersion: index.version, regimes };
}

/** One entry per line, so a weekly commit is one added line in the diff. */
export function serializeLedger(entries: LedgerEntry[]): string {
  const lines = entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return [
    '{',
    '  "format": 1,',
    '  "index": "mancale-ledger",',
    '  "note": "Written by npm run mancale, one line per refresh, never by hand and never edited afterwards. It records the label each chokepoint had in the latest week when the refresh ran, so the scorecard can show what was recorded before the outcome weeks existed. Labels only: no score is stored.",',
    '  "entries": [',
    lines,
    '  ]',
    '}',
    '',
  ].join('\n');
}

/** Whether an entry was written soon enough after its week to count as a recorded call. */
export function isTimely(entry: LedgerEntry): boolean {
  return daysBetween(addDays(entry.weekStart, 6), entry.recordedOn) <= SCORECARD_METHOD.timelyWithinDays;
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

/** 95% Wilson score interval for a proportion. Sound at the small counts this page will have. */
export function wilson(successes: number, n: number, z = 1.96): { low: number; high: number } | null {
  if (n <= 0) return null;
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

interface Outcome {
  status: CallStatus;
  weeksSeen: number;
  bestMove: number;
}

/**
 * What followed the week at `at`: did `moves` rise by `moveBy` in any of the
 * next `horizonWeeks` weeks? A rise settles it at once. No rise settles it
 * only when every outcome week is in the data; until then it is pending.
 */
export function outcomeAfter(weeks: MancaleWeek[], at: number, moves: ScorecardMoves): Outcome | null {
  const start = weeks[at][moves];
  if (start === null) return null;
  const last = addDays(weeks[at].weekStart, SCORECARD_METHOD.horizonWeeks * 7);
  let weeksSeen = 0;
  let bestMove = 0;
  for (let next = at + 1; next < weeks.length && weeks[next].weekStart <= last; next += 1) {
    const value = weeks[next][moves];
    if (value === null) continue;
    weeksSeen += 1;
    bestMove = Math.max(bestMove, value - start);
    if (bestMove >= SCORECARD_METHOD.moveBy) return { status: 'followed', weeksSeen, bestMove };
  }
  const complete = weeks[weeks.length - 1].weekStart >= last;
  return { status: complete ? 'not-followed' : 'pending', weeksSeen, bestMove };
}

function tally(statuses: CallStatus[]): Tally {
  const followed = statuses.filter((status) => status === 'followed').length;
  const settled = statuses.filter((status) => status !== 'pending').length;
  const pending = statuses.length - settled;
  const readable = settled >= SCORECARD_METHOD.minCallsToRead;
  const interval = readable ? wilson(followed, settled) : null;
  return {
    settled,
    followed,
    pending,
    rate: readable ? followed / settled : null,
    low: interval?.low ?? null,
    high: interval?.high ?? null,
  };
}

/** The first week of a run of one label: the previous week is missing or had another label. */
function startsRun(weeks: MancaleWeek[], at: number): boolean {
  if (at === 0) return true;
  const before = weeks[at - 1];
  return before.weekStart !== addDays(weeks[at].weekStart, -7) || before.regime !== weeks[at].regime;
}

export function buildScorecard(index: MancaleIndex, ledger: LedgerEntry[]): Scorecard {
  const warnings: string[] = [];
  const withNews = index.chokepoints.filter((point) => point.hasNews);
  const byId = new Map<string, MancaleChokepoint>(index.chokepoints.map((point) => [point.id, point]));

  const timely = ledger.filter(isTimely);
  const lateWeeks = ledger.length - timely.length;
  if (lateWeeks > 0) {
    warnings.push(`${lateWeeks} ledger ${lateWeeks === 1 ? 'entry was' : 'entries were'} written more than ${SCORECARD_METHOD.timelyWithinDays} days after the week ended and count as history.`);
  }

  // Recorded labels that the data no longer agrees with. Listed, never counted.
  const revisions: ScorecardRevision[] = [];
  const recordedKeys = new Map<string, LedgerEntry>();
  for (const entry of timely) {
    for (const [id, recorded] of Object.entries(entry.regimes)) {
      const point = byId.get(id);
      const at = point?.weeks.findIndex((week) => week.weekStart === entry.weekStart) ?? -1;
      if (!point || at < 0) continue;
      const now = point.weeks[at].regime;
      if (now !== recorded) {
        revisions.push({ weekStart: entry.weekStart, chokepointId: id, chokepointLabel: point.label, recorded, now, recordedOn: entry.recordedOn });
      } else {
        recordedKeys.set(`${id}|${entry.weekStart}`, entry);
      }
    }
  }

  const tests: ScorecardTestResult[] = SCORECARD_TESTS.map((test) => {
    const calls: ScorecardCall[] = [];
    const ordinary: CallStatus[] = [];

    for (const point of withNews) {
      point.weeks.forEach((week, at) => {
        const outcome = outcomeAfter(point.weeks, at, test.moves);
        if (!outcome) return;

        const start = week[test.moves];
        if (start !== null && start < SCORECARD_METHOD.baselineStartsBelow) ordinary.push(outcome.status);

        if (week.regime !== test.regime || !startsRun(point.weeks, at)) return;
        const entry = recordedKeys.get(`${point.id}|${week.weekStart}`);
        calls.push({
          testId: test.id,
          chokepointId: point.id,
          chokepointLabel: point.label,
          weekStart: week.weekStart,
          origin: entry ? 'recorded' : 'history',
          recordedOn: entry ? entry.recordedOn : null,
          status: outcome.status,
          weeksSeen: outcome.weeksSeen,
          bestMove: outcome.bestMove,
        });
      });
    }

    calls.sort((a, b) => (a.weekStart === b.weekStart ? (a.chokepointId < b.chokepointId ? -1 : 1) : a.weekStart < b.weekStart ? 1 : -1));
    return {
      test,
      recorded: tally(calls.filter((call) => call.origin === 'recorded').map((call) => call.status)),
      history: tally(calls.filter((call) => call.origin === 'history').map((call) => call.status)),
      ordinary: tally(ordinary),
      calls,
    };
  });

  return {
    version: SCORECARD_METHOD.version,
    firstRecordedWeek: timely.length > 0 ? timely[0].weekStart : null,
    recordedWeeks: timely.length,
    lateWeeks,
    tests,
    revisions: revisions.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    warnings,
  };
}
