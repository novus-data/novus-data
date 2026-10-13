/**
 * Which chokepoint a post is about, read from its Beehiiv tags.
 *
 * A writer tags a post "Hormuz" or "Panama Canal" in Beehiiv, the sync copies
 * the tag into the file, and the home page map lists the post under that
 * place. The link is the writer's decision, made once in the tool they
 * already use, so it needs no hand-edit after the sync (Rule 6).
 *
 * Deliberately not inferred from the text. A briefing that mentions Panama in
 * passing is not a post about Panama, and a map that filed it there would be
 * stating something nobody decided.
 *
 * Pure data, safe anywhere, including the client.
 */

/**
 * The tags that file a post under each chokepoint, keyed by the ids in
 * `src/lib/live/nodes.ts`. Compared ignoring case, hyphens and extra spaces,
 * so "Bab el Mandeb" and "bab-el-mandeb" both match. WRITING.md lists these
 * for writers; change both together.
 */
export const PLACE_TAGS: Readonly<Record<string, readonly string[]>> = {
  suez: ['Suez', 'Suez Canal'],
  'bab-el-mandeb': ['Bab el-Mandeb'],
  hormuz: ['Hormuz', 'Strait of Hormuz'],
  'singapore-strait': ['Malacca', 'Strait of Malacca', 'Singapore Strait'],
  'taiwan-strait': ['Taiwan Strait'],
  panama: ['Panama', 'Panama Canal'],
  bosphorus: ['Bosphorus', 'Bosporus'],
  gibraltar: ['Gibraltar', 'Strait of Gibraltar'],
  dover: ['Dover', 'Strait of Dover'],
  'cape-of-good-hope': ['Cape of Good Hope'],
};

function normalise(tag: string): string {
  return tag.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

const PLACE_BY_TAG = new Map<string, string>(
  Object.entries(PLACE_TAGS).flatMap(([id, tags]) =>
    tags.map((tag) => [normalise(tag), id] as const),
  ),
);

/**
 * The chokepoint ids a post's tags name, in tag order and without repeats.
 * Tags that name no chokepoint, such as "Article", are ignored.
 */
export function placesForTags(tags: readonly string[]): string[] {
  const ids = tags
    .map((tag) => PLACE_BY_TAG.get(normalise(tag)))
    .filter((id): id is string => id !== undefined);
  return [...new Set(ids)];
}
