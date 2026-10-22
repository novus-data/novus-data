/**
 * `npm run mancale` — refresh the Mancalë Index data file.
 *
 *   npm run mancale                       download ship and news data, write the file
 *   npm run mancale -- --ships-csv <file> use a PortWatch CSV you downloaded by hand
 *   npm run mancale -- --offline          rebuild from the local cache, no network
 *   npm run mancale -- --refresh-news     re-download news even if the cache is fresh
 *
 * WHAT IT WRITES
 *
 * content/indicators/mancale.json: for each of the seven chokepoints, the mean
 * daily ship transits per week (IMF PortWatch) and the mean daily share of
 * English-language news per week (GDELT). Nothing else. Every score on the
 * page is computed from these at build time by src/lib/indicators/
 * mancale-method.ts, which this script also uses, so the two cannot disagree.
 *
 * WHEN TO RUN IT
 *
 * Once a week, after PortWatch publishes (Tuesdays). Then review the summary
 * it prints, commit content/indicators/, and push. Vercel deploys. It is a
 * manual step on purpose: CLAUDE.md §13 keeps scheduled workflows out of this
 * repository.
 *
 * TERMS (read before relying on the automatic download)
 *
 * - IMF data may be reused with the citation "Source: International Monetary
 *   Fund, PortWatch", and a transformation must be stated (the page does).
 *   The IMF's terms say bulk download by automated means, and any commercial
 *   reuse, need its permission (copyright@imf.org). Until that is confirmed,
 *   --ships-csv lets you download the CSV from portwatch.imf.org by hand.
 * - GDELT is free for any use, including commercial, with a citation and a
 *   link to gdeltproject.org. It asks for at most one request every five
 *   seconds; this waits ten, and backs off when told to slow down (HTTP 429).
 *
 * The cache (.mancale-cache/, git-ignored) makes the slow news download
 * resumable: run the script again and finished chokepoints are kept.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { blank, heading, info, ok, warn } from './lib/cli';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.mancale-cache');
const NEWS_CACHE = path.join(CACHE, 'news');
const SHIPS_CACHE = path.join(CACHE, 'ships.json');
const OUTPUT = path.join(ROOT, 'content', 'indicators', 'mancale.json');

const PORTWATCH_QUERY =
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';
const USER_AGENT = 'NovusData-Mancale/0.2 (+https://github.com/novus-data/novus-data)';
const START_DAY = '2019-01-01';
const NEWS_CACHE_MAX_AGE_DAYS = 6;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const todayIso = () => new Date().toISOString().slice(0, 10);

interface DailyRow {
  date: string;
  portname: string;
  total: number;
}

function normaliseDay(value: unknown): string | null {
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10).replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

// ---------------------------------------------------------------------------
// Ships
// ---------------------------------------------------------------------------

async function shipsFromApi(names: string[]): Promise<DailyRow[]> {
  const rows: DailyRow[] = [];
  const where = `portname IN (${names.map((name) => `'${name}'`).join(',')})`;
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(PORTWATCH_QUERY);
    url.search = new URLSearchParams({
      where,
      outFields: 'date,portname,n_total',
      orderByFields: 'portname,date',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'json',
    }).toString();

    let body: { features?: { attributes: Record<string, unknown> }[]; exceededTransferLimit?: boolean } | null = null;
    for (let attempt = 1; attempt <= 5 && !body; attempt += 1) {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(90_000) });
        const json = await response.json();
        if (Array.isArray(json.features)) body = json;
      } catch {
        // retried below
      }
      if (!body) {
        warn(`PortWatch page at offset ${offset}: attempt ${attempt} failed, retrying.`);
        await sleep(3000 * attempt);
      }
    }
    if (!body?.features) throw new Error(`PortWatch did not answer at offset ${offset}.`);

    for (const feature of body.features) {
      const day = normaliseDay(feature.attributes.date);
      const total = Number(feature.attributes.n_total);
      if (day && Number.isFinite(total)) rows.push({ date: day, portname: String(feature.attributes.portname), total });
    }
    if (!body.exceededTransferLimit && body.features.length < 1000) break;
  }
  return rows;
}

async function shipsFromCsv(file: string): Promise<DailyRow[]> {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map((cell) => cell.replace(/^"|"$/g, '').trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const [dateAt, nameAt, totalAt] = [at('date'), at('portname'), at('n_total')];
  if (dateAt < 0 || nameAt < 0 || totalAt < 0) {
    throw new Error(`${file} needs the columns date, portname and n_total (PortWatch's Daily Chokepoints Data CSV).`);
  }
  const rows: DailyRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim());
    const day = normaliseDay(cells[dateAt]);
    const total = Number(cells[totalAt]);
    if (day && Number.isFinite(total)) rows.push({ date: day, portname: cells[nameAt], total });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

interface NewsCache {
  retrievedAt: string;
  query: string;
  points: { date: string; value: number }[];
}

async function readNewsCache(id: string): Promise<NewsCache | null> {
  const file = path.join(NEWS_CACHE, `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as NewsCache;
  } catch {
    return null;
  }
}

async function fetchNews(id: string, query: string): Promise<NewsCache | null> {
  const url = new URL(GDELT_DOC);
  url.search = new URLSearchParams({
    query,
    mode: 'timelinevol',
    format: 'json',
    startdatetime: `${START_DAY.replace(/-/g, '')}000000`,
    enddatetime: `${todayIso().replace(/-/g, '')}235959`,
  }).toString();

  let wait = 20_000;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      if (response.ok) {
        const json = (await response.json()) as { timeline?: { data?: { date: string; value: number }[] }[] };
        const data = json.timeline?.[0]?.data;
        if (Array.isArray(data) && data.length > 0) {
          const points = data.map((point) => ({ date: point.date.slice(0, 8), value: Number(point.value) }));
          const cache: NewsCache = { retrievedAt: todayIso(), query, points };
          await writeFile(path.join(NEWS_CACHE, `${id}.json`), JSON.stringify(cache));
          ok(`${id}: ${points.length} days of news volume (attempt ${attempt}).`);
          return cache;
        }
        warn(`${id}: GDELT answered but sent no timeline (attempt ${attempt}).`);
      } else {
        info(`${id}: GDELT HTTP ${response.status} (attempt ${attempt}); waiting ${wait / 1000}s.`);
      }
    } catch (error) {
      info(`${id}: ${(error as Error).message} (attempt ${attempt}); waiting ${wait / 1000}s.`);
    }
    await sleep(wait);
    wait = Math.min(wait + 10_000, 60_000);
  }
  return null;
}

// ---------------------------------------------------------------------------

async function main() {
  const { MANCALE_CHOKEPOINTS, MANCALE_METHOD, addDays, lastCompleteWeekStart, mondayOf, scoreChokepoint, weeklyMeans } =
    await import('../src/lib/indicators/mancale-method');
  await mkdir(NEWS_CACHE, { recursive: true });

  heading('Mancalë: ship traffic (IMF PortWatch)');
  let rows: DailyRow[];
  let shipsRetrievedAt: string;
  const csv = option('--ships-csv');
  if (csv) {
    rows = await shipsFromCsv(path.resolve(csv));
    shipsRetrievedAt = todayIso();
    info(`Read ${rows.length} daily rows from ${csv}. Recorded as retrieved today; change "retrieved.portwatch" if you downloaded it earlier.`);
  } else if (flag('--offline')) {
    if (!existsSync(SHIPS_CACHE)) throw new Error('No cached ship data. Run once without --offline.');
    const cache = JSON.parse(await readFile(SHIPS_CACHE, 'utf8')) as { retrievedAt: string; rows: DailyRow[] };
    rows = cache.rows;
    shipsRetrievedAt = cache.retrievedAt;
    info(`Using cached ship data retrieved ${shipsRetrievedAt}.`);
  } else {
    rows = await shipsFromApi(MANCALE_CHOKEPOINTS.map((c) => c.portwatchName));
    shipsRetrievedAt = todayIso();
    await writeFile(SHIPS_CACHE, JSON.stringify({ retrievedAt: shipsRetrievedAt, rows }));
    ok(`${rows.length} daily rows.`);
  }

  const lastDay = rows.reduce((max, row) => (row.date > max ? row.date : max), '');
  if (!lastDay) throw new Error('No ship data rows. Nothing written.');
  const lastWeek = lastCompleteWeekStart(lastDay);

  // From the Monday on or before 1 January 2019. That first week is partial; it
  // has data, so it is kept, and the baseline uses it.
  const weekStarts: string[] = [];
  for (let week = mondayOf(START_DAY); week <= lastWeek; week = addDays(week, 7)) weekStarts.push(week);

  heading('Mancalë: news volume (GDELT)');
  const chokepoints: Record<string, unknown> = {};
  for (const [index, config] of MANCALE_CHOKEPOINTS.entries()) {
    const daily = new Map<string, number>();
    for (const row of rows) if (row.portname === config.portwatchName) daily.set(row.date, row.total);
    if (daily.size === 0) warn(`${config.label}: no ship rows under the PortWatch name "${config.portwatchName}".`);
    const weekly = weeklyMeans(daily);

    let news = await readNewsCache(config.id);
    const fresh =
      news && news.query === config.newsQuery && Date.parse(todayIso()) - Date.parse(news.retrievedAt) <= NEWS_CACHE_MAX_AGE_DAYS * 86_400_000;
    if (!flag('--offline') && (!fresh || flag('--refresh-news'))) {
      if (index > 0) await sleep(10_000);
      news = (await fetchNews(config.id, config.newsQuery)) ?? (news?.query === config.newsQuery ? news : null);
      if (!news) warn(`${config.label}: no news volume yet. It is scored on ships only; run again later.`);
    } else if (news) {
      info(`${config.id}: using cached news volume retrieved ${news.retrievedAt}.`);
    }

    let newsWeekly: Map<string, number> | null = null;
    if (news && news.query === config.newsQuery) {
      const dailyNews = new Map<string, number>();
      for (const point of news.points) {
        const day = `${point.date.slice(0, 4)}-${point.date.slice(4, 6)}-${point.date.slice(6, 8)}`;
        if (!dailyNews.has(day) && Number.isFinite(point.value)) dailyNews.set(day, point.value);
      }
      newsWeekly = weeklyMeans(dailyNews);
    }

    chokepoints[config.id] = {
      transits: weekStarts.map((week) => (weekly.has(week) ? Number(weekly.get(week)!.toFixed(4)) : null)),
      newsSharePct: newsWeekly
        ? weekStarts.map((week) => (newsWeekly!.has(week) ? Number(newsWeekly!.get(week)!.toPrecision(6)) : null))
        : null,
      newsRetrievedAt: newsWeekly ? news!.retrievedAt : null,
    };
  }

  const previous = existsSync(OUTPUT) ? await readFile(OUTPUT, 'utf8').catch(() => null) : null;
  const output = {
    format: 1,
    index: 'mancale',
    note: 'Written by npm run mancale. Weekly averages only; every score is computed at build time by src/lib/indicators/mancale-method.ts.',
    methodVersion: MANCALE_METHOD.version,
    dataThrough: lastDay,
    retrieved: { portwatch: shipsRetrievedAt },
    weekStarts,
    chokepoints,
  };
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`);

  heading('Mancalë: this week');
  const { readMancale } = await import('../src/lib/indicators/sources/local-file');
  const index = await readMancale();
  if (!index) throw new Error('The file was written but does not load. Nothing to commit.');
  const before = previous ? scoredFrom(previous) : null;
  for (const point of index.chokepoints) {
    const latest = point.latest;
    const was = before?.get(point.id);
    const change = was && was !== latest.regime ? `  (was ${was})` : '';
    const gap = latest.gap === null ? 'no news yet' : `gap ${latest.gap >= 0 ? '+' : ''}${latest.gap.toFixed(2)}`;
    info(`${point.label.padEnd(24)} ships ${latest.flowVsBaselinePct >= 0 ? '+' : ''}${latest.flowVsBaselinePct.toFixed(0)}% vs normal, ${gap}, ${latest.regime}${change}`);
  }
  for (const warning of index.warnings) warn(warning);
  blank();
  ok(`Wrote ${path.relative(ROOT, OUTPUT)}: week of ${index.latestWeekStart}, data through ${index.dataThrough}.`);
  info('Next: git add content/indicators/ && git commit -m "mancale: week of ' + index.latestWeekStart + '" && git push');

  function scoredFrom(text: string): Map<string, string> | null {
    // Score the previous file in memory, so the summary can name what changed.
    try {
      const old = JSON.parse(text) as { weekStarts: string[]; chokepoints: Record<string, { transits: (number | null)[]; newsSharePct: (number | null)[] | null }> };
      const out = new Map<string, string>();
      for (const [id, entry] of Object.entries(old.chokepoints)) {
        const scored = scoreChokepoint(old.weekStarts, entry.transits, entry.newsSharePct);
        if (scored) out.set(id, scored.weeks[scored.weeks.length - 1].regime);
      }
      return out;
    } catch {
      return null;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
