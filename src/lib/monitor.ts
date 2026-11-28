/**
 * What /monitor and /live.json both read: the live snapshot, the flags and
 * place board derived from it, and the open register entries naming each
 * place.
 *
 * It sits outside both layers because it joins them. The live layer does
 * not read the register — layers stay independent — so the two joins happen
 * here, once, and the page and the feed cannot disagree about what is
 * flagged or which entry names which place.
 */

import { listDisruptions, type DisruptionSummary } from '@/lib/disruptions';
import { deriveFlags, derivePlaces, getLiveSnapshot, getLiveSnapshotWithVessels, type Reading, type VesselFeedData } from '@/lib/live';

/**
 * `vessels: true` also builds the per-vessel feed from the SAME AIS sample
 * (no second socket). /monitor asks for it to draw the ship panels; /live.json
 * does not, so its regeneration never touches the vessel registry.
 */
export async function readMonitor(options: { vessels?: boolean } = {}) {
  const open = (await listDisruptions()).filter((d) => d.status !== 'resolved');

  // Companies already on the exposure chart are the only ones ever quoted;
  // config/markets.ts says why.
  const tickers = new Map<string, string>();
  for (const d of open) {
    for (const exposure of d.exposures) {
      if (exposure.entity.ticker) tickers.set(exposure.entity.ticker, exposure.entity.name);
    }
  }
  const registerByPlace: Record<string, DisruptionSummary[]> = {};
  for (const d of open) {
    for (const place of d.places) (registerByPlace[place] ??= []).push(d);
  }

  const snapshotOptions = { extraSymbols: [...tickers].map(([symbol, label]) => ({ symbol, label })) };
  let vessels: Reading<VesselFeedData> | null = null;
  let snapshot;
  if (options.vessels) {
    ({ snapshot, vessels } = await getLiveSnapshotWithVessels(snapshotOptions));
  } else {
    snapshot = await getLiveSnapshot(snapshotOptions);
  }
  const flags = deriveFlags(snapshot);
  const places = derivePlaces(snapshot, flags);

  return { snapshot, flags, places, registerByPlace, vessels };
}
