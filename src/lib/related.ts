/**
 * Links between the register and the writing, decided by the writers' tags.
 *
 * A post reaches a place only through a Beehiiv tag its writer chose
 * (src/lib/places.ts), never by matching its text: a briefing that mentions
 * Panama in passing is not a post about Panama. These helpers use that same
 * decision to link a register entry to the posts about its place, and a post
 * to the open entries about its place. Nothing is typed by hand, so a new post
 * or entry arrives with the sync and needs no edit (Rule 6).
 *
 * Server only: both layers read the filesystem.
 */

import { articlesEnabled } from '@/config/launch';
import type { IssueSummary } from '@/lib/content';
import { listArticles, listIssues } from '@/lib/content';
import type { DisruptionSummary } from '@/lib/disruptions';
import { listDisruptions } from '@/lib/disruptions';
import { placesForTags } from '@/lib/places';

/** How many posts a register entry lists. The archive has the rest. */
export const RELATED_POSTS_SHOWN = 4;

function newestFirst(a: IssueSummary, b: IssueSummary): number {
  return (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0);
}

/**
 * Posts a reader may open whose writer tagged them with any of these places,
 * newest first. Articles are left out while the section is switched off, so
 * a link never leads to a page that 404s.
 */
export async function postsAboutPlaces(
  places: readonly string[],
  limit = RELATED_POSTS_SHOWN,
): Promise<IssueSummary[]> {
  if (places.length === 0) return [];
  const [briefings, articles] = await Promise.all([
    listIssues(),
    articlesEnabled ? listArticles() : Promise.resolve([]),
  ]);
  return [...briefings, ...articles]
    .filter((post) => placesForTags(post.tags).some((place) => places.includes(place)))
    .sort(newestFirst)
    .slice(0, limit);
}

/**
 * Open register entries naming any place a post is tagged with, in register
 * order (active first, then most recently reviewed). Resolved entries keep
 * their own pages but are not offered from a post as current.
 */
export async function openEntriesAboutPost(post: IssueSummary): Promise<DisruptionSummary[]> {
  const places = placesForTags(post.tags);
  if (places.length === 0) return [];
  return (await listDisruptions()).filter(
    (entry) => entry.status !== 'resolved' && entry.places.some((place) => places.includes(place)),
  );
}
