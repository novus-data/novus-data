import { articlesEnabled } from '@/config/launch';
import { publication } from '@/config/publication';
import { POST_KIND_LABELS, listArticles, listIssues, postPath } from '@/lib/content';
import { absoluteUrl } from '@/lib/env';

/**
 * Everything written for the site as RSS 2.0: the same list as /feed.json, in
 * the format most feed readers, news aggregators and newsletter tools expect.
 *
 * Why a second format: JSON Feed is the better format to build on, and the
 * register's feed stays JSON only. But a reader who pastes novusdata.news into
 * a feed reader, or an aggregator that only speaks RSS, should find the posts
 * and land on their pages here rather than on a copy elsewhere. Beehiiv's own
 * feed (linked in the footer) points at Beehiiv's copies.
 *
 * The rules are feed.json's. Summaries only, never bodies, so there is no
 * second copy of a post to keep right. A post with no parseable date carries
 * no <pubDate> rather than today's (§6); RSS allows that. No <lastBuildDate>:
 * the only date available is the build's, and a build date presented as a
 * publication date is a false provenance claim (PrintPermalink makes the same
 * point). Every `<guid>` is the post's permanent address, because slugs never
 * change (§6).
 */

export const dynamic = 'force-static';

function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const [briefings, articles] = await Promise.all([
    listIssues(),
    articlesEnabled ? listArticles() : Promise.resolve([]),
  ]);
  const posts = [...briefings, ...articles].sort(
    (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
  );

  const self = absoluteUrl('/rss.xml');
  const items = posts.map((post) => {
    const url = absoluteUrl(postPath(post));
    const published = Date.parse(post.publishedAt);
    return [
      '    <item>',
      `      <title>${xml(post.title)}</title>`,
      `      <link>${xml(url)}</link>`,
      `      <guid isPermaLink="true">${xml(url)}</guid>`,
      post.excerpt ? `      <description>${xml(post.excerpt)}</description>` : null,
      Number.isFinite(published) ? `      <pubDate>${new Date(published).toUTCString()}</pubDate>` : null,
      `      <category>${xml(POST_KIND_LABELS[post.kind])}</category>`,
      ...post.tags
        .filter((tag) => tag.trim().toLowerCase() !== POST_KIND_LABELS[post.kind].toLowerCase())
        .map((tag) => `      <category>${xml(tag)}</category>`),
      '    </item>',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xml(publication.name)}</title>`,
    `    <link>${xml(absoluteUrl('/'))}</link>`,
    `    <description>${xml(
      articlesEnabled
        ? 'Briefings, articles and long-term reviews, newest first. Summaries only; each post is read on its page.'
        : 'Briefings, newest first. Summaries only; each post is read on its page.',
    )}</description>`,
    '    <language>en-gb</language>',
    `    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
