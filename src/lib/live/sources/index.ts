/**
 * Chooses where live readings come from, and assembles the snapshot.
 *
 * CONTENT_SOURCE=fixtures means the same thing here as it does for the issue
 * archive and the register, so `npm run dev:demo` populates every page at
 * once. Deciding it here is also what puts ./fixtures in the import graph, and
 * so what makes its production guard fire.
 *
 * ---------------------------------------------------------------------------
 * ISOLATION
 *
 * Every source is settled independently. A feed that is down, slow, rate
 * limited or reshaped becomes one panel saying "unavailable" and why — it
 * never throws out of here, never delays the others beyond its own timeout,
 * and never takes the page with it. `Promise.all` over settled promises is
 * safe for exactly that reason.
 * ---------------------------------------------------------------------------
 */

import { MARKET_SYMBOLS, type MarketSymbol } from '@/config/markets';

import { SOURCE_META } from '../meta';
import type { LiveSnapshot, LiveSourceId, Reading } from '../types';
import type { VesselFeedData } from '../vessels';
import { fetchAis, parseAis, type AisSummary } from './ais';
import { fetchEonet, parseEonet } from './eonet';
import * as fixtures from './fixtures';
import { fetchFred, parseFred } from './fred';
import { fetchGdacs, parseGdacs } from './gdacs';
import { fetchGdelt, parseGdelt } from './gdelt';
import { LiveSourceError } from './http';
import { fetchNhc, parseNhc } from './nhc';
import { fetchQuotes, parseQuotes } from './quotes';
import { listCarriers } from '@/lib/carriers';

import { AIR_NODES } from '../air-nodes';
import { parseStates, summariseAir, type AirData, type ParseResult } from '../air';
import { fetchOpenSky } from './opensky';
import { fetchUsgs, parseUsgs } from './usgs';
import { buildVesselFeed } from './vessels';
import { fetchWeather, parseWeather } from './weather';

export type LiveSourceName = 'network' | 'fixtures';

export function getLiveSourceName(): LiveSourceName {
  return process.env.CONTENT_SOURCE === 'fixtures' ? 'fixtures' : 'network';
}

async function settle<T>(source: LiveSourceId, run: () => Promise<Reading<T>>): Promise<Reading<T>> {
  try {
    return await run();
  } catch (error) {
    const reason =
      error instanceof LiveSourceError
        ? error.publicReason
        : `${SOURCE_META[source].name} could not be read.`;
    // The reason is always a sentence this layer wrote, so it is safe to log.
    console.warn(`[live] ${source}: ${reason}`);
    return { status: 'unavailable', source, reason };
  }
}

/**
 * Runs a keyed source with the secret from the variable its SOURCE_META entry
 * names, or reports it not configured. Server-only: the key is read here,
 * passed to the adapter, and never stored in a Reading.
 */
async function withKey<T>(source: 'ais' | 'quotes', run: (key: string) => Promise<Reading<T>>): Promise<Reading<T>> {
  const envVar = SOURCE_META[source].requiresEnv!;
  const key = process.env[envVar]?.trim();
  return key ? run(key) : { status: 'not-configured', source, envVar };
}

/** The configured funds, then any extra symbols the caller passes, without duplicates. */
function symbolsFor(extra: MarketSymbol[]): MarketSymbol[] {
  const seen = new Set<string>();
  return [...MARKET_SYMBOLS, ...extra].filter(({ symbol }) => {
    const key = symbol.trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface SnapshotOptions {
  /**
   * Tickers of companies on the exposure chart. The live layer does not read
   * the register itself — layers stay independent — so the page passes them.
   */
  extraSymbols?: MarketSymbol[];
  /**
   * Called with the raw AIS sample before it becomes a Reading. Lets
   * `npm run live:check` report on the per-vessel records from the SAME
   * sample rather than opening a second socket. The page never passes it.
   */
  onAisSummary?: (summary: AisSummary) => void;
}

function tap(summary: AisSummary, options: SnapshotOptions): AisSummary {
  options.onAisSummary?.(summary);
  return summary;
}

export async function readLiveSnapshot(options: SnapshotOptions = {}): Promise<LiveSnapshot> {
  const demo = getLiveSourceName() === 'fixtures';
  const symbols = symbolsFor(options.extraSymbols ?? []);

  const [ais, gdelt, usgs, gdacs, nhc, eonet, weather, fred, quotes] = await Promise.all([
    settle('ais', async () =>
      demo
        ? parseAis(tap(fixtures.fixtureAis(), options))
        : withKey('ais', async (key) => parseAis(tap(await fetchAis(key), options))),
    ),
    settle('gdelt', async () => parseGdelt(demo ? fixtures.fixtureGdelt() : await fetchGdelt())),
    settle('usgs', async () => parseUsgs(demo ? fixtures.fixtureUsgs() : await fetchUsgs())),
    settle('gdacs', async () => parseGdacs(demo ? fixtures.fixtureGdacs() : await fetchGdacs())),
    settle('nhc', async () => parseNhc(demo ? fixtures.fixtureNhc() : await fetchNhc())),
    settle('eonet', async () => parseEonet(demo ? fixtures.fixtureEonet() : await fetchEonet())),
    settle('weather', async () => parseWeather(demo ? fixtures.fixtureWeather() : await fetchWeather())),
    settle('fred', async () => parseFred(demo ? fixtures.fixtureFred() : await fetchFred())),
    settle('quotes', async () =>
      demo
        ? parseQuotes(fixtures.fixtureQuotes(symbols))
        : withKey('quotes', async (key) => parseQuotes(await fetchQuotes(key, symbols))),
    ),
  ]);

  return {
    // When this snapshot was assembled — i.e. when the page was regenerated.
    // Displayed as such, and never used as any reading's age.
    generatedAt: new Date().toISOString(),
    ais,
    gdelt,
    usgs,
    gdacs,
    nhc,
    eonet,
    weather,
    fred,
    quotes,
  };
}

/**
 * The per-vessel feed behind /vessels.json. One AIS socket per call, exactly
 * like the snapshot: AISStream allows three connections per key, and /monitor,
 * /live.json and /vessels.json each regenerate on their own schedule, so at
 * worst three are open at once. Settled like every other reading — a failure
 * is "unavailable", a missing key is "not-configured".
 */
export async function readVesselFeed(): Promise<Reading<VesselFeedData>> {
  const demo = getLiveSourceName() === 'fixtures';
  return settle('ais', async () =>
    demo
      ? buildVesselFeed(fixtures.fixtureAis())
      : withKey('ais', async (key) => buildVesselFeed(await fetchAis(key))),
  );
}

/**
 * The snapshot AND the per-vessel feed from ONE AIS sample — what /monitor
 * needs once it draws ships. The vessel feed is built from the same summary
 * the chokepoint counts came from (via onAisSummary), so the page opens no
 * second socket. When the AIS reading itself failed or is not configured, the
 * vessel reading says the same thing rather than inventing a second outcome.
 */
export async function readLiveSnapshotWithVessels(
  options: SnapshotOptions = {},
): Promise<{ snapshot: LiveSnapshot; vessels: Reading<VesselFeedData> }> {
  let summary: AisSummary | null = null;
  const snapshot = await readLiveSnapshot({
    ...options,
    onAisSummary: (captured) => {
      summary = captured;
      options.onAisSummary?.(captured);
    },
  });
  const sample = summary as AisSummary | null;
  let vessels: Reading<VesselFeedData>;
  if (snapshot.ais.status === 'not-configured') vessels = snapshot.ais;
  else if (snapshot.ais.status === 'unavailable' || !sample) {
    vessels = {
      status: 'unavailable',
      source: 'ais',
      reason: snapshot.ais.status === 'unavailable' ? snapshot.ais.reason : 'AISStream could not be read.',
    };
  } else {
    vessels = await settle('ais', () => buildVesselFeed(sample));
  }
  return { snapshot, vessels };
}

/**
 * Aircraft near the eight air-cargo hubs (Vessels Part 3B). Separate from the
 * snapshot, so /live.json is unchanged. Not configured, and no network call,
 * unless BOTH OpenSky credentials are set (they are read here and passed
 * straight to the adapter, never stored).
 *
 * Only approved operator designators (carrier records of kind air-operator,
 * each citing FAA Order JO 7340.2) identify a flight; every other aircraft is
 * a count. Returns the Reading only: no icao24 or callsign of an unmatched
 * aircraft is in it.
 */
export async function readAirFeed(): Promise<Reading<AirData>> {
  const demo = getLiveSourceName() === 'fixtures';
  const clientId = process.env.OPENSKY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim();
  if (!demo && (!clientId || !clientSecret)) {
    return { status: 'not-configured', source: 'opensky', envVar: 'OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET' };
  }
  return settle('opensky', async () => {
    const results: ParseResult[] = demo
      ? fixtures.fixtureOpenSky().map(({ node, body }) => parseStates(body, AIR_NODES.find((n) => n.id === node)!))
      : (await fetchOpenSky(clientId!, clientSecret!)).results;
    return buildAirReading(results);
  });
}

/** Results to a Reading. Exported for the tests. */
export async function buildAirReading(results: ParseResult[], operatorsOverride?: { id: string; name: string; designators: string[]; asOf: string; sources: { url: string; publisher: string }[] }[]): Promise<Reading<AirData>> {
  const operators = operatorsOverride ?? (await listCarriers()).carriers.filter((c) => c.kind === 'air-operator');
  const sightings = results.flatMap((r) => r.sightings);
  const { nodes, matchedOperatorIds } = summariseAir(AIR_NODES, sightings, operators);
  const dropped = { noPosition: 0, malformed: 0, notAircraft: 0, outsideBox: 0 };
  for (const r of results) for (const key of Object.keys(dropped) as (keyof typeof dropped)[]) dropped[key] += r.dropped[key];
  const latest = results.map((r) => r.latest).filter((v): v is string => v !== null).sort().pop() ?? null;
  const notes: string[] = [];
  const droppedTotal = dropped.noPosition + dropped.malformed + dropped.notAircraft;
  if (droppedTotal > 0) {
    notes.push(`${droppedTotal} records were left out (${dropped.noPosition} with no position, ${dropped.notAircraft} surface vehicles or obstacles, ${dropped.malformed} malformed).`);
  }
  if (sightings.some((s) => s.timeBasis === 'last-contact')) {
    notes.push('Where OpenSky had no recent position time, the time shown is its last contact with the transponder.');
  }
  return {
    status: 'ok',
    source: 'opensky',
    asOf: latest ?? new Date().toISOString(),
    asOfBasis: latest ? 'latest aircraft report received' : 'time of the request (no aircraft in any box)',
    data: {
      nodes,
      operators: operators
        .filter((o) => matchedOperatorIds.has(o.id))
        .map((o) => ({ id: o.id, name: o.name, designators: o.designators, asOf: o.asOf, publisher: o.sources[0].publisher, url: o.sources[0].url })),
      designatorsLoaded: operators.reduce((n, o) => n + o.designators.length, 0),
      dropped,
    },
    notes,
  };
}
