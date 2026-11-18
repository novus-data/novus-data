/**
 * Which tracked place (src/lib/live/nodes.ts) each Mancalë chokepoint is.
 *
 * The register and the index name the same waters with two id spaces: a
 * register entry lists `places` from the live layer's nodes, and the index
 * scores chokepoints by its own ids. Every id is the same in both except one:
 * the index calls the east end of the Strait of Malacca "malacca", and the
 * node for it is "singapore-strait".
 *
 * This file is the one place that join lives, so the Mancalë map, the
 * register entry pages and the Mancalë chokepoint pages cannot disagree about
 * which chokepoint is which place. It is pure data with no imports, so a
 * client component can read it (the map does) without pulling the
 * filesystem-backed indicators index into the browser.
 *
 * What the join is allowed to carry: a link. The register may point to a
 * chokepoint's Mancalë page and a Mancalë page may list the register entries
 * that name its place, but no Mancalë label or figure is printed outside
 * /mancale (CLAUDE.md §4, Rule 1 and its Mancalë amendments).
 */
export const MANCALE_NODE_FOR: Readonly<Record<string, string>> = {
  hormuz: 'hormuz',
  'bab-el-mandeb': 'bab-el-mandeb',
  suez: 'suez',
  panama: 'panama',
  'taiwan-strait': 'taiwan-strait',
  malacca: 'singapore-strait',
  bosphorus: 'bosphorus',
};

/** The tracked place a Mancalë chokepoint stands for, or null for an id the join does not know. */
export function nodeForMancaleId(mancaleId: string): string | null {
  return MANCALE_NODE_FOR[mancaleId] ?? null;
}

/**
 * The Mancalë chokepoint ids for some tracked places, in the order the places
 * were given, without repeats. A place the index does not score (a port, the
 * Cape of Good Hope) contributes nothing.
 */
export function mancaleIdsForPlaces(places: readonly string[]): string[] {
  const ids: string[] = [];
  for (const place of places) {
    for (const [mancaleId, node] of Object.entries(MANCALE_NODE_FOR)) {
      if (node === place && !ids.includes(mancaleId)) ids.push(mancaleId);
    }
  }
  return ids;
}
