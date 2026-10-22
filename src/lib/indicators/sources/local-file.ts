/**
 * Reads the Mancalë data file, `content/indicators/mancale.json`, and scores it.
 *
 * The file is written by `npm run mancale` and holds only sourced weekly
 * averages: ship transits from IMF PortWatch and news share from GDELT. Every
 * score is computed here, at build time, by the same functions the page
 * describes (../mancale-method.ts).
 *
 * The same guarantee as the other two layers: a bad chokepoint warns and is
 * skipped rather than taking down the build, and a missing file means the
 * page says there is no data yet. Nothing is ever substituted: a week with no
 * value stays empty, and today's date never stands in for the as-of date.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MANCALE_CHOKEPOINTS,
  MANCALE_METHOD,
  addDays,
  daysBetween,
  scoreChokepoint,
} from '../mancale-method';
import type { MancaleChokepoint, MancaleIndex, Source } from '../types';

export const MANCALE_FILE = path.join(process.cwd(), 'content', 'indicators', 'mancale.json');

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** null, or a finite non-negative number. Anything else is a broken file, not a value. */
function series(raw: unknown, length: number): (number | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== length) return null;
  const out: (number | null)[] = [];
  for (const value of raw) {
    if (value === null) out.push(null);
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out.push(value);
    else return null;
  }
  return out;
}

export function portwatchSource(portwatchName: string, retrievedAt: string): Source {
  return {
    title: `Daily Chokepoints Data: ${portwatchName} (weekly averages and scores calculated by Novus Data)`,
    url: 'https://portwatch.imf.org/',
    publisher: 'International Monetary Fund, PortWatch',
    retrievedAt,
  };
}

export function gdeltSource(query: string, retrievedAt: string): Source {
  return {
    title: `DOC 2.0 API, news volume timeline for the query ${query}`,
    url: 'https://www.gdeltproject.org/',
    publisher: 'The GDELT Project',
    retrievedAt,
  };
}

export async function readMancale(today: string = new Date().toISOString().slice(0, 10)): Promise<MancaleIndex | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(MANCALE_FILE, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[indicators] ${MANCALE_FILE} could not be read: ${(error as Error).message}`);
    }
    return null;
  }

  const warnings: string[] = [];
  const file = raw as Record<string, unknown>;
  if (file.format !== 1 || file.index !== 'mancale') {
    console.warn(`[indicators] ${MANCALE_FILE} is not a format-1 Mancalë file. Run npm run mancale.`);
    return null;
  }
  if (!isIsoDay(file.dataThrough)) {
    // The as-of date is the one value the page cannot do without (§14.1).
    console.warn(`[indicators] ${MANCALE_FILE} has no valid dataThrough date, so nothing is shown.`);
    return null;
  }
  const dataThrough = file.dataThrough;
  const retrieved = (file.retrieved ?? {}) as Record<string, unknown>;
  if (!isIsoDay(retrieved.portwatch)) {
    console.warn(`[indicators] ${MANCALE_FILE} does not say when the ship data was retrieved, so nothing is shown.`);
    return null;
  }
  const portwatchRetrievedAt = retrieved.portwatch;

  const weekStarts = file.weekStarts;
  if (
    !Array.isArray(weekStarts) ||
    weekStarts.length === 0 ||
    !weekStarts.every((week, index) => isIsoDay(week) && (index === 0 || addDays(weekStarts[index - 1], 7) === week))
  ) {
    console.warn(`[indicators] ${MANCALE_FILE} weekStarts must be consecutive Mondays as "YYYY-MM-DD".`);
    return null;
  }

  const entries = (file.chokepoints ?? {}) as Record<string, Record<string, unknown>>;
  const chokepoints: MancaleChokepoint[] = [];

  for (const config of MANCALE_CHOKEPOINTS) {
    const entry = entries[config.id];
    if (!entry) {
      warnings.push(`Refused: ${config.label} is missing from the data file.`);
      continue;
    }
    const transits = series(entry.transits, weekStarts.length);
    if (!transits) {
      warnings.push(`Refused: ${config.label} has a transit series that is not one number or null per week.`);
      continue;
    }

    let news: (number | null)[] | null = null;
    let newsRetrievedAt: string | null = null;
    if (entry.newsSharePct !== null && entry.newsSharePct !== undefined) {
      news = series(entry.newsSharePct, weekStarts.length);
      newsRetrievedAt = isIsoDay(entry.newsRetrievedAt) ? entry.newsRetrievedAt : null;
      if (!news || !newsRetrievedAt) {
        // News without a retrieval date is an unsourced figure. Score ships only.
        warnings.push(`Corrected: ${config.label} news volume was dropped (bad series or no newsRetrievedAt); ships only.`);
        news = null;
        newsRetrievedAt = null;
      }
    }

    const scored = scoreChokepoint(weekStarts as string[], transits, news);
    if (!scored) {
      warnings.push(`Refused: ${config.label} has no baseline weeks to score against.`);
      continue;
    }

    const weeks = scored.weeks;
    const latest = weeks[weeks.length - 1];
    let weeksInRegime = 0;
    for (let index = weeks.length - 1; index >= 0 && weeks[index].regime === latest.regime; index -= 1) {
      weeksInRegime += 1;
    }
    let newsPeak: MancaleChokepoint['newsPeak'] = null;
    for (const week of weeks) {
      if (week.newsSharePct !== null && (!newsPeak || week.newsSharePct > newsPeak.sharePct)) {
        newsPeak = { weekStart: week.weekStart, sharePct: week.newsSharePct };
      }
    }

    const sources = [portwatchSource(config.portwatchName, portwatchRetrievedAt)];
    if (news && newsRetrievedAt) sources.push(gdeltSource(config.newsQuery, newsRetrievedAt));

    chokepoints.push({
      id: config.id,
      label: config.label,
      portwatchName: config.portwatchName,
      newsQuery: news ? config.newsQuery : null,
      hasNews: news !== null,
      baselineTransitsPerDay: scored.baselineTransitsPerDay,
      baselineNewsSharePct: scored.baselineNewsSharePct,
      weeks,
      latest,
      weeksInRegime,
      newsPeak,
      note: config.note,
      sources,
    });
  }

  for (const warning of warnings) console.warn(`[indicators] ${warning}`);
  if (chokepoints.length === 0) return null;

  const latestWeekStart = chokepoints[0].latest.weekStart;
  return {
    version: MANCALE_METHOD.version,
    dataThrough,
    latestWeekStart,
    staleAtBuild: daysBetween(dataThrough, today) > MANCALE_METHOD.staleAfterDays,
    chokepoints,
    warnings,
  };
}
