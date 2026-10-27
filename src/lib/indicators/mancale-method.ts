/**
 * The Mancalë Index method. Pure functions and constants, no I/O.
 *
 * "Mancalë" is Quenya, one of Tolkien's Elvish languages, for "commerce"
 * (from manca-, "to trade", root MBAKH in The Etymologies).
 *
 * The index asks one question of each chokepoint, every week: is the news
 * louder or quieter than the ships passing through it justify?
 *
 *   Flow stress  (0–6)  how unusually FEW ships passed, against a frozen normal
 *   Attention    (0–6)  how unusually LOUD the news coverage was, same normal
 *   Gap = attention − flow stress
 *
 * WHY THIS FILE IS SHARED
 *
 * The refresh script (scripts/mancale.ts) imports `weeklyMeans` to turn daily
 * upstream data into the weekly averages it commits. The site imports
 * `scoreChokepoint` and scores those committed averages at build time. The
 * page prints MANCALE_METHOD. So the method a reader is shown, the method the
 * scores were computed with and the method the script assumed are the same
 * object — they cannot drift, which is the §14a rule for published standards.
 *
 * The data file therefore holds only sourced weekly averages (ship transits
 * and news share). Every score is derived here, never stored.
 */

import type { MancaleRegime, MancaleWeek } from './types';

export const MANCALE_METHOD = {
  version: '0.2',
  /** Weeks ending on or before this day define "normal". Never re-estimated. */
  baselineEnd: '2022-12-31',
  /** Both scores are capped here so one extreme week cannot dominate. */
  cap: 6,
  /** Floor on the ship-traffic scale, as a fraction of the baseline median. */
  flowScaleFloor: 0.03,
  /** Floor on the news scale, in log units. */
  newsScaleFloor: 0.15,
  /** Added to news share (percent) before the log, so a zero-coverage week is defined. */
  newsEpsilon: 0.0005,
  /** Gap at or above this: news ahead of ships. */
  narrativeLedAt: 2,
  /** Gap at or below this: ships ahead of news. */
  realityLedAt: -2,
  /** Attention and flow stress both below this: quiet. */
  quietBelow: 1,
  /** Flow stress at or above this, with no news data: ships disrupted. */
  elevatedAt: 2,
  /** Flow stress at or above this, with no news data: severely disrupted. */
  severeAt: 4,
  /** Flow surge at or above this, with no news data: ships above normal. */
  surgeAt: 2,
  /** Data older than this when the page is built is shown as not refreshed. */
  staleAfterDays: 21,
} as const;

export interface MancaleChokepointConfig {
  id: string;
  label: string;
  portwatchName: string;
  newsQuery: string;
  note: string;
}

/**
 * The seven chokepoints. ids match src/lib/live/nodes.ts where the site has
 * the same place; Malacca is scored as PortWatch's "Malacca Strait".
 *
 * Notes carry no figures on purpose: a number in a note would go stale the
 * week after it was written, and nothing would flag it.
 */
export const MANCALE_CHOKEPOINTS: MancaleChokepointConfig[] = [
  {
    id: 'hormuz',
    label: 'Strait of Hormuz',
    portwatchName: 'Strait of Hormuz',
    newsQuery: '"Strait of Hormuz" sourcelang:english',
    note:
      'PortWatch counts ships from their location signals. In a conflict zone many ships switch them off, so a collapse in counted transits can overstate the fall in real traffic.',
  },
  {
    id: 'bab-el-mandeb',
    label: 'Red Sea / Bab el-Mandeb',
    portwatchName: 'Bab el-Mandeb Strait',
    newsQuery:
      '("Red Sea" OR "Bab el-Mandeb" OR "Bab al-Mandab") (shipping OR ships OR vessels OR maritime OR tanker OR container) sourcelang:english',
    note:
      'The news query needs a shipping word next to "Red Sea" or "Bab el-Mandeb", so coverage of the Red Sea in other contexts does not count.',
  },
  {
    id: 'suez',
    label: 'Suez Canal',
    portwatchName: 'Suez Canal',
    newsQuery: '"Suez Canal" (shipping OR ships OR vessels OR maritime OR tanker OR container) sourcelang:english',
    note:
      'Most Suez traffic also passes Bab el-Mandeb, so the two readings usually move together. The news query needs a shipping word next to "Suez Canal", so coverage of the canal in other contexts does not count.',
  },
  {
    id: 'panama',
    label: 'Panama Canal',
    portwatchName: 'Panama Canal',
    newsQuery: '"Panama Canal" (shipping OR ships OR vessels OR maritime OR tanker OR container) sourcelang:english',
    note:
      'The canal authority sets daily slots and draft limits, and a change to either moves traffic directly. Its advisories explain most changes in this series. The news query needs a shipping word next to "Panama Canal"; a story about who controls the canal still counts if it mentions shipping, so a political week can read as louder than the ships justify.',
  },
  {
    id: 'taiwan-strait',
    label: 'Taiwan Strait',
    portwatchName: 'Taiwan Strait',
    newsQuery: '"Taiwan Strait" sourcelang:english',
    note:
      'A very busy lane whose traffic dips around holidays and in typhoon season. The index is not seasonally adjusted, so a short dip with no news is usually seasonal.',
  },
  {
    id: 'malacca',
    label: 'Strait of Malacca',
    portwatchName: 'Malacca Strait',
    newsQuery: '("Strait of Malacca" OR "Malacca Strait") sourcelang:english',
    note:
      'Flow stress counts only traffic below normal, so a busier strait scores zero. A lasting shift from the 2019–22 level can reflect a change in tracking coverage as well as in trade.',
  },
  {
    id: 'bosphorus',
    label: 'Bosporus',
    portwatchName: 'Bosporus Strait',
    newsQuery: '("Bosphorus" OR "Bosporus") (shipping OR ships OR vessels OR tankers) sourcelang:english',
    note:
      'A lasting shift from the 2019–22 level can reflect a change in tracking coverage as well as in trade. Treat a high reading here with more caution than a sudden one.',
  },
];

// ---------------------------------------------------------------------------
// Dates. Everything is a UTC calendar day; no local time zone is ever involved.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday on or before a day. */
export function mondayOf(iso: string): string {
  const day = dayNumber(iso);
  // 1970-01-01 was a Thursday, so day 4 was a Monday.
  return isoFromDay(day - ((((day - 4) % 7) + 7) % 7));
}

export function addDays(iso: string, days: number): string {
  return isoFromDay(dayNumber(iso) + days);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

// ---------------------------------------------------------------------------
// Daily to weekly. Used by the refresh script.
// ---------------------------------------------------------------------------

/**
 * Mean of each Monday-to-Sunday week, over the days that have a value.
 * A week with no values at all is absent from the result, not zero.
 */
export function weeklyMeans(daily: Map<string, number>): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const [day, value] of daily) {
    if (!Number.isFinite(value)) continue;
    const week = mondayOf(day);
    const entry = sums.get(week) ?? { total: 0, count: 0 };
    entry.total += value;
    entry.count += 1;
    sums.set(week, entry);
  }
  const out = new Map<string, number>();
  for (const week of [...sums.keys()].sort()) {
    const { total, count } = sums.get(week)!;
    out.set(week, total / count);
  }
  return out;
}

/**
 * The weeks that are complete in data running to `lastDay`: every week whose
 * Sunday is on or before it.
 */
export function lastCompleteWeekStart(lastDay: string): string {
  return mondayOf(addDays(lastDay, -6));
}

// ---------------------------------------------------------------------------
// Scoring. Used by the site, at build time.
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Robust z-scores against the baseline weeks: median and 1.4826 × MAD, with a floor on the scale. */
export function robustZ(
  values: (number | null)[],
  inBaseline: boolean[],
  floor: number,
  relative: boolean,
): { z: (number | null)[]; centre: number; scale: number } | null {
  const base = values.filter((value, index): value is number => inBaseline[index] && value !== null);
  if (base.length === 0) return null;
  const centre = median(base);
  const mad = 1.4826 * median(base.map((value) => Math.abs(value - centre)));
  const scale = Math.max(mad, relative ? floor * Math.abs(centre) : floor);
  if (!(scale > 0)) return null;
  return { z: values.map((value) => (value === null ? null : (value - centre) / scale)), centre, scale };
}

function clip(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function regimeFor(attention: number | null, flowStress: number, flowSurge: number): MancaleRegime {
  const m = MANCALE_METHOD;
  if (attention === null) {
    if (flowStress >= m.severeAt) return 'flow-only-severe';
    if (flowStress >= m.elevatedAt) return 'flow-only-elevated';
    return flowSurge >= m.surgeAt ? 'flow-only-surge' : 'flow-only-normal';
  }
  if (attention < m.quietBelow && flowStress < m.quietBelow) return 'quiet';
  const gap = attention - flowStress;
  if (gap >= m.narrativeLedAt) return 'narrative-led';
  if (gap <= m.realityLedAt) return 'reality-led';
  return 'aligned';
}

export interface ScoredSeries {
  weeks: MancaleWeek[];
  baselineTransitsPerDay: number;
  baselineNewsSharePct: number | null;
}

/**
 * Score one chokepoint's weekly series.
 *
 * `transits` and `newsSharePct` are aligned with `weekStarts`. A null transit
 * week is dropped (there is nothing to score). `newsSharePct` is null when no
 * news volume has been collected for the chokepoint at all.
 */
export function scoreChokepoint(
  weekStarts: string[],
  transits: (number | null)[],
  newsSharePct: (number | null)[] | null,
): ScoredSeries | null {
  const m = MANCALE_METHOD;
  const keep = weekStarts.map((_, index) => transits[index] !== null);
  const weeks = weekStarts.filter((_, index) => keep[index]);
  const flow = transits.filter((_, index) => keep[index]) as number[];
  const news = newsSharePct ? newsSharePct.filter((_, index) => keep[index]) : null;
  if (weeks.length === 0) return null;

  const inBaseline = weeks.map((week) => addDays(week, 6) <= m.baselineEnd);

  const flowZ = robustZ(flow, inBaseline, m.flowScaleFloor, true);
  if (!flowZ) return null;

  const logNews = news ? news.map((share) => (share === null ? null : Math.log(share + m.newsEpsilon))) : null;
  const newsZ = logNews ? robustZ(logNews, inBaseline, m.newsScaleFloor, false) : null;
  const baselineShare = newsZ ? Math.exp(newsZ.centre) - m.newsEpsilon : null;

  const scored: MancaleWeek[] = weeks.map((weekStart, index) => {
    const z = flowZ.z[index] as number;
    const flowStress = clip(-z, 0, m.cap);
    const flowSurge = clip(z, 0, m.cap);
    const share = news ? news[index] : null;
    const nz = newsZ ? newsZ.z[index] : null;
    const attention = nz === null || nz === undefined ? null : clip(nz, 0, m.cap);
    return {
      weekStart,
      transitsPerDay: flow[index],
      flowVsBaselinePct: (flow[index] / flowZ.centre - 1) * 100,
      flowStress,
      flowSurge,
      newsSharePct: share,
      newsXBaseline: share !== null && baselineShare ? share / baselineShare : null,
      attention,
      gap: attention === null ? null : attention - flowStress,
      regime: regimeFor(attention, flowStress, flowSurge),
    };
  });

  return { weeks: scored, baselineTransitsPerDay: flowZ.centre, baselineNewsSharePct: baselineShare };
}
