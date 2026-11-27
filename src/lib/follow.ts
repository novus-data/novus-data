/**
 * Follow feeds: RSS for one company, one industry, one place, or the whole
 * register. The first working piece of Novus Data Alerts (CLAUDE.md §14.2).
 *
 * ---------------------------------------------------------------------------
 * WHY FEEDS, AND WHY THEY KEEP THE SITE STATIC
 *
 * The alerts app needs a service that stores who follows what. A feed needs
 * nothing stored at all: the reader's feed reader keeps the list, polls the
 * file and shows what is new. So following works today without an account, a
 * database, a cookie or a line of /privacy changing, and every feed is a
 * static file built with the rest of the site.
 *
 * ---------------------------------------------------------------------------
 * HOW A FEED READER SEES A CHANGE WITHOUT AN EVENT LOG
 *
 * The register holds current state, not events (§6c), and this file invents
 * no events. A feed reader decides an item is new by its <guid>. So each guid
 * is built from the values whose change a follower should hear about, every
 * one of them written and dated by a person:
 *
 *   - on a company or sector feed, one item per disruption reaching it, keyed
 *     by the disruption, its status, and this name's severity, confidence and
 *     as-of date. A new disruption, a change of status or a revised assessment
 *     arrives as a new item; a review that changes nothing about this name
 *     does not.
 *   - on the register, industry and place feeds, one item per disruption,
 *     keyed by the disruption, its status, its strongest severity and the set
 *     of names it reaches. A new entry, a change of status or severity, or a
 *     company added to a disruption arrives as a new item.
 *
 * That is exactly the first version /alerts promised: a new entry, a change of
 * status, or a new company added. Nothing derived, nothing forecast.
 *
 * A guid is opaque (isPermaLink="false"); each item's <link> is the page.
 * The dates are the record's own: an item's <pubDate> is the as-of date of the
 * assessment, or the review date of the entry, never the build date (the
 * reason /rss.xml gives: a build date presented as a publication date is a
 * false provenance claim).
 * ---------------------------------------------------------------------------
 */

import { publication } from '@/config/publication';
import type { DisruptionSummary, Exposure } from '@/lib/disruptions';
import {
  CONFIDENCE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  listDisruptions,
  worstOf,
} from '@/lib/disruptions';
import { absoluteUrl } from '@/lib/env';
import { nodeById } from '@/lib/live/nodes';

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  description: string;
  /** ISO day. */
  date: string;
  categories: string[];
}

export interface FollowFeed {
  title: string;
  description: string;
  /** The page this feed is about. */
  link: string;
  /** The feed's own address, for <atom:link rel="self">. */
  self: string;
  items: FeedItem[];
}

/** "Container shipping" → "container-shipping". Stable for any sector string. */
export function industrySlug(sector: string): string {
  return sector
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A short, stable fingerprint of a list of ids. Not security: a change detector. */
function fingerprint(values: string[]): string {
  let hash = 5381;
  for (const char of [...values].sort().join('|')) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function disruptionItem(disruption: DisruptionSummary, prefix: string): FeedItem {
  const severity = disruption.exposures.length > 0 ? worstOf(disruption.exposures) : null;
  const names = disruption.exposures.map((exposure) => exposure.entity.name);
  const reaches =
    names.length > 0 ? ` Reaches: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', and others' : ''}.` : '';
  return {
    title: `${disruption.title} (${STATUS_LABELS[disruption.status]})`,
    link: absoluteUrl(`/disruptions/${disruption.id}`),
    guid: [
      prefix,
      disruption.id,
      disruption.status,
      severity ?? 'none',
      fingerprint(disruption.exposures.map((exposure) => exposure.entity.id)),
    ].join('/'),
    description: `${disruption.summary}${reaches} Last reviewed ${disruption.updatedAt}.`,
    date: disruption.updatedAt,
    categories: [STATUS_LABELS[disruption.status], ...(severity ? [`${SEVERITY_LABELS[severity]} severity`] : [])],
  };
}

function exposureItem(disruption: DisruptionSummary, exposure: Exposure, entityId: string): FeedItem {
  return {
    title: `${disruption.title}: ${SEVERITY_LABELS[exposure.severity]} severity for ${exposure.entity.name} (${STATUS_LABELS[disruption.status]})`,
    link: absoluteUrl(`/disruptions/${disruption.id}`),
    guid: [
      'entities',
      entityId,
      disruption.id,
      disruption.status,
      exposure.severity,
      exposure.confidence,
      exposure.asOf,
    ].join('/'),
    description: `${exposure.mechanism} Confidence: ${CONFIDENCE_LABELS[exposure.confidence].toLowerCase()}. Assessed as of ${exposure.asOf}.`,
    date: exposure.asOf,
    categories: [STATUS_LABELS[disruption.status], `${SEVERITY_LABELS[exposure.severity]} severity`],
  };
}

const newestFirst = (a: FeedItem, b: FeedItem) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);

export async function registerFeed(): Promise<FollowFeed> {
  const all = await listDisruptions();
  return {
    title: `${publication.name}: every disruption`,
    description:
      'Every entry in the Novus Data disruption register. A new item appears when an entry opens, changes status or strongest severity, or reaches a new company or sector.',
    link: absoluteUrl('/disruptions'),
    self: absoluteUrl('/disruptions/feed.xml'),
    items: all.map((d) => disruptionItem(d, 'register')).sort(newestFirst),
  };
}

export async function entityFeed(id: string): Promise<FollowFeed | null> {
  const all = await listDisruptions();
  const items: FeedItem[] = [];
  let name: string | null = null;
  for (const disruption of all) {
    for (const exposure of disruption.exposures) {
      if (exposure.entity.id !== id) continue;
      name = exposure.entity.name;
      items.push(exposureItem(disruption, exposure, id));
    }
  }
  if (!name) return null;
  return {
    title: `${publication.name}: ${name}`,
    description: `Every disruption in the Novus Data register assessed to reach ${name}. A new item appears when one opens, changes status, or its assessment of ${name} is revised.`,
    link: absoluteUrl(`/entities/${id}`),
    self: absoluteUrl(`/entities/${id}/feed.xml`),
    items: items.sort(newestFirst),
  };
}

export interface IndustryIndex {
  slug: string;
  name: string;
}

/** Every industry (an entity's `sector`) the register has named, resolved entries included. */
export async function listIndustries(): Promise<IndustryIndex[]> {
  const bySlug = new Map<string, string>();
  for (const disruption of await listDisruptions()) {
    for (const exposure of disruption.exposures) {
      const slug = industrySlug(exposure.entity.sector);
      if (slug && !bySlug.has(slug)) bySlug.set(slug, exposure.entity.sector);
    }
  }
  return [...bySlug].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function industryFeed(slug: string): Promise<FollowFeed | null> {
  const all = await listDisruptions();
  const industry = (await listIndustries()).find((i) => i.slug === slug);
  if (!industry) return null;
  const items = all
    .filter((d) => d.exposures.some((exposure) => industrySlug(exposure.entity.sector) === slug))
    .map((d) => disruptionItem(d, `industries/${slug}`));
  return {
    title: `${publication.name}: ${industry.name}`,
    description: `Every disruption in the Novus Data register assessed to reach a company or sector in ${industry.name}.`,
    link: absoluteUrl('/follow'),
    self: absoluteUrl(`/follow/industry/${slug}/feed.xml`),
    items: items.sort(newestFirst),
  };
}

export interface PlaceIndex {
  id: string;
  name: string;
}

/** Every place a register entry names in `places`, resolved entries included. */
export async function listPlaces(): Promise<PlaceIndex[]> {
  const ids = new Set<string>();
  for (const disruption of await listDisruptions()) for (const place of disruption.places) ids.add(place);
  return [...ids]
    .map((id) => ({ id, name: nodeById(id)?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function placeFeed(id: string): Promise<FollowFeed | null> {
  const place = (await listPlaces()).find((p) => p.id === id);
  if (!place) return null;
  const items = (await listDisruptions())
    .filter((d) => d.places.includes(id))
    .map((d) => disruptionItem(d, `places/${id}`));
  return {
    title: `${publication.name}: ${place.name}`,
    description: `Every disruption in the Novus Data register that concerns ${place.name}.`,
    link: absoluteUrl('/follow'),
    self: absoluteUrl(`/follow/place/${id}/feed.xml`),
    items: items.sort(newestFirst),
  };
}

function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(day: string): string | null {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(parsed) ? new Date(parsed).toUTCString() : null;
}

/** RSS 2.0, the format every feed reader and most email-from-feed tools read. */
export function renderRss(feed: FollowFeed): Response {
  const items = feed.items.map((item) => {
    const date = rfc822(item.date);
    return [
      '    <item>',
      `      <title>${xml(item.title)}</title>`,
      `      <link>${xml(item.link)}</link>`,
      // A tag URI (RFC 4151): unique and stable, and plainly not an address to open.
      `      <guid isPermaLink="false">tag:novusdata.news,2026:${xml(item.guid)}</guid>`,
      `      <description>${xml(item.description)}</description>`,
      date ? `      <pubDate>${date}</pubDate>` : null,
      ...item.categories.map((category) => `      <category>${xml(category)}</category>`),
      '    </item>',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xml(feed.title)}</title>`,
    `    <link>${xml(feed.link)}</link>`,
    `    <description>${xml(`${feed.description} Analysis and commentary, not investment advice.`)}</description>`,
    '    <language>en-gb</language>',
    `    <atom:link href="${xml(feed.self)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
