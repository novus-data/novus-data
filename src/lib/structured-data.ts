/**
 * Structured data builders.
 *
 * Every field here has to be backed by something real. Where a value is not
 * available — no author name, no external URL — the key is left out entirely
 * rather than filled with a placeholder, because structured data is consumed
 * by machines that will repeat whatever it is told.
 */

import { namedAuthors, publication, recordedBy } from '@/config/publication';
import type { Issue } from '@/lib/content';
import type { Disruption } from '@/lib/disruptions/types';
import { absoluteUrl, env } from '@/lib/env';
import { toDate } from '@/lib/format';

type Json = Record<string, unknown>;

/** Drop keys whose value is null or undefined. */
function compact(input: Json): Json {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null));
}

export function publicationJsonLd(): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: publication.name,
    description: publication.description,
    url: absoluteUrl('/'),
    email: env.contactEmail ?? undefined,
    // Everyone on the masthead, so the organisation's own markup matches the
    // byline a reader sees rather than naming only the first person.
    founder: namedAuthors().length > 0
      ? namedAuthors().map((author) => ({ '@type': 'Person', name: author.name }))
      : undefined,
    sameAs: [env.beehiivHomeUrl].filter((value): value is string => Boolean(value)),
  });
}

export function issueJsonLd(issue: Issue, canonicalUrl: string): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: issue.title,
    description: issue.excerpt ?? undefined,
    datePublished: toDate(issue.publishedAt)?.toISOString(),
    dateModified: toDate(issue.publishedAt)?.toISOString(),
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    articleSection: issue.kind,
    keywords: issue.tags.length > 0 ? issue.tags : undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    // The person who wrote this post, not the whole masthead: listing every
    // author would credit co-authors with pieces they did not write.
    author: (() => {
      const writer = recordedBy(issue.author);
      return writer?.name ? { '@type': 'Person', name: writer.name } : undefined;
    })(),
    publisher: { '@type': 'Organization', name: publication.name },
    image: issue.coverImageUrl ?? undefined,
    isPartOf: {
      '@type': 'Periodical',
      name: publication.name,
      url: absoluteUrl('/'),
    },
  });
}

/**
 * The register as a schema.org Dataset, for /data.
 *
 * Google's Dataset Search lists pages that carry this markup, which is where a
 * researcher or a journalist looking for disruption data would find the
 * register's files. Only the register is described: the Mancalë Index is built
 * on IMF PortWatch and GDELT data whose terms govern reuse, and /data says it
 * is not part of the downloads.
 *
 * No count of entries or rows (Rule 1). The two dates are the register's own:
 * the earliest date an entry began, and the latest review. The coverage runs
 * open-ended ("../") because the register is still being kept.
 */
export function registerDatasetJsonLd(dates: {
  earliestStart: string | null;
  latestReview: string | null;
}): Json {
  const day = (value: string | null): string | undefined => {
    const date = toDate(value);
    return date ? date.toISOString().slice(0, 10) : undefined;
  };
  const start = day(dates.earliestStart);

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${publication.name} disruption register`,
    description:
      'Disruptions in physical trade (chokepoints, ports, trade measures, inputs, energy, labour and weather), each with its status, start date, review date and sources, and the companies and sectors each one reaches, with the mechanism, severity, confidence, as-of date and sources behind every assessment.',
    url: absoluteUrl('/data'),
    creator: { '@type': 'Organization', name: publication.name, url: absoluteUrl('/') },
    isAccessibleForFree: true,
    inLanguage: 'en-GB',
    keywords: ['supply chain', 'shipping', 'trade policy', 'chokepoints', 'disruption', 'exposure'],
    dateModified: day(dates.latestReview),
    temporalCoverage: start ? `${start}/..` : undefined,
    conditionsOfAccess:
      'Quote or cite any entry with a link to its page and its review date. Ask first for bulk, commercial or redistribution use.',
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: absoluteUrl('/register.csv') },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/feed+json',
        contentUrl: absoluteUrl('/register.json'),
      },
    ],
  });
}

/**
 * A register entry, as an Article.
 *
 * `datePublished` is when the disruption was first recorded and `dateModified`
 * is the review date, which is the one that matters — a consumer reading this
 * should be able to see how current the assessment is without opening the page.
 * Fields that cannot be filled from real data are omitted, as everywhere else.
 */
export function disruptionJsonLd(disruption: Disruption, canonicalUrl: string): Json {
  const iso = (value: string): string | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: disruption.title,
    description: disruption.summary,
    datePublished: iso(disruption.startedAt) ?? iso(disruption.updatedAt),
    dateModified: iso(disruption.updatedAt),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    // The person who made THIS assessment, not a site-wide byline. Falls back
    // to the editor, who stands behind anything the publication prints.
    author: (() => {
      const recorder = recordedBy(disruption.author);
      return recorder ? { '@type': 'Person', name: recorder.name } : undefined;
    })(),
    publisher: { '@type': 'Organization', name: publication.name },
    // Only the entry's own citations, which are required to exist at all.
    citation: disruption.sources.map((source) => ({
      '@type': 'CreativeWork',
      name: source.title,
      url: source.url,
      publisher: { '@type': 'Organization', name: source.publisher },
    })),
    about: disruption.exposures.map((exposure) => ({
      '@type': 'Thing',
      name: exposure.entity.name,
    })),
  });
}
