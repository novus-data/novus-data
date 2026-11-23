import type { Metadata } from 'next';
import Link from 'next/link';

import { Container } from '@/components/container';
import { JsonLd } from '@/components/json-ld';
import { PrintPermalink } from '@/components/print-permalink';
import { ProseBody } from '@/components/prose-body';
import { ShareLinks } from '@/components/share-links';
import { StatusBadge } from '@/components/status-badge';
import { StoryBox } from '@/components/story-box';
import { SubscribePanel } from '@/components/subscribe-panel';
import { ExternalLink, TextLink } from '@/components/text-link';
import { hasCoAuthors, publication, recordedBy } from '@/config/publication';
import { POST_KIND_LABELS, postPath, type Issue, type IssueNeighbours, type IssueSummary } from '@/lib/content/types';
// The types module, not the layer index, which pulls in the filesystem source.
import type { DisruptionSummary } from '@/lib/disruptions/types';
import { absoluteUrl } from '@/lib/env';
import { formatIssueLabel, formatLongDate, readingTimeMinutes, toDate } from '@/lib/format';
import { metaDescription } from '@/lib/seo';
import { issueJsonLd } from '@/lib/structured-data';

/**
 * The reading page for every post — a briefing at /briefings/[slug], an
 * article or long-term review at /articles/[slug]. One page, so the measure,
 * type and print behaviour cannot drift between them. A briefing shows its
 * issue number; an article or review names its kind above the title instead,
 * because those are not numbered.
 */

/**
 * Every post's canonical address is its page on this site.
 *
 * It used to be the Beehiiv copy wherever one existed, on the reading that a
 * post is emailed first and so the sending platform's web copy is the
 * original. That was written while this site was framed as the newsletter's
 * information page, which CLAUDE.md §1 records as the wrong framing: this
 * repository is the archive of record (§6). A canonical link names the copy a
 * search engine should index, so pointing it at Beehiiv kept every synced post
 * out of search under novusdata.news, in favour of a copy that sits outside
 * the register, the map and the subscribe flow. The Beehiiv copy stays linked
 * under the body ("Originally published on Beehiiv"). Google no longer
 * recommends cross-domain canonicals for syndicated copies in any case
 * (CLAUDE.md §6, "Which copy search engines index").
 */
function canonicalFor(post: IssueSummary): string {
  return absoluteUrl(postPath(post));
}

export function postMetadata(post: Issue): Metadata {
  // Shortened only in the meta tags; the page and its structured data keep the
  // whole standfirst.
  const description = metaDescription(post.excerpt ?? publication.description);
  return {
    title: post.title,
    description,
    alternates: { canonical: canonicalFor(post) },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: absoluteUrl(postPath(post)),
      publishedTime: toDate(post.publishedAt)?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
    },
  };
}

export function PostPage({
  post,
  previous,
  next,
  registerEntries = [],
}: { post: Issue } & IssueNeighbours & {
  /**
   * Open register entries about the places this post's writer tagged it with
   * (openEntriesAboutPost in src/lib/related.ts). Empty for an untagged post.
   */
  registerEntries?: DisruptionSummary[];
}) {
  const briefing = post.kind === 'briefing';
  const kindLabel = POST_KIND_LABELS[post.kind];
  const kind = kindLabel.toLowerCase();
  const date = formatLongDate(post.publishedAt);
  const number = briefing ? formatIssueLabel(post.issueNumber) : null;
  // A real measurement of the stored text. Omitted entirely when there is no
  // body to measure, rather than defaulted to something.
  const minutes = readingTimeMinutes(post.contentHtml);
  // With one author the masthead already says who wrote everything; with more
  // than one, each post names its writer (Rule 2), falling back to the editor.
  const writer = hasCoAuthors() ? recordedBy(post.author) : null;

  return (
    <article>
      <JsonLd data={issueJsonLd(post, canonicalFor(post))} />

      <Container width="reading" className="pt-8 sm:pt-12">
        <p className="text-meta text-muted">
          <TextLink href={briefing ? '/briefings' : '/articles'} className="no-underline hover:underline">
            {briefing ? 'Briefings' : 'Articles'}
          </TextLink>
        </p>

        {/* The whole piece is one boxed story: headline, standfirst, metadata
            and body all sit on the same backing, as the front page's boxes do. */}
        <div className="story story-lead mt-4">
          <header>
            <p className="kicker">{briefing ? publication.newsletter.name : kindLabel}</p>
            <h1 className="mt-3 text-title font-semibold text-fg">{post.title}</h1>

            {post.excerpt ? (
              <p className="mt-5 max-w-measure text-subhead text-muted">{post.excerpt}</p>
            ) : null}

            {/* A rule here divides the metadata from the body — it is dividing
                two real things, which is the only reason this site draws a rule. */}
            <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-3 border-t border-hairline pt-4 text-meta">
              {number ? (
                <div>
                  <dt className="text-muted">Issue</dt>
                  <dd data-numeric className="mt-0.5 text-fg">
                    {number}
                  </dd>
                </div>
              ) : null}
              {writer?.name ? (
                <div>
                  <dt className="text-muted">Written by</dt>
                  <dd className="mt-0.5 text-fg">{writer.name}</dd>
                </div>
              ) : null}
              {date ? (
                <div>
                  <dt className="text-muted">Published</dt>
                  <dd className="mt-0.5 text-fg">
                    <time dateTime={post.publishedAt}>{date}</time>
                  </dd>
                </div>
              ) : null}
              {minutes !== null ? (
                <div>
                  <dt className="text-muted">Reading time</dt>
                  <dd data-numeric className="mt-0.5 text-fg">
                    {minutes} min
                  </dd>
                </div>
              ) : null}
            </dl>
          </header>

          {post.coverImageUrl ? <CoverImage src={post.coverImageUrl} /> : null}

          <div className="mt-4">
            {post.contentHtml ? (
              <ProseBody html={post.contentHtml} />
            ) : (
              <p className="max-w-measure text-muted">
                The text of this {briefing ? 'issue' : kind} is not stored here.
                {post.externalUrl ? (
                  <>
                    {' '}
                    <ExternalLink href={post.externalUrl}>Read it on Beehiiv</ExternalLink>.
                  </>
                ) : null}
              </p>
            )}

            {post.externalUrl ? (
              <p className="mt-12 max-w-measure text-meta text-muted">
                Originally published on{' '}
                <ExternalLink href={post.externalUrl}>Beehiiv</ExternalLink>.
              </p>
            ) : null}

            <ShareLinks path={postPath(post)} title={post.title} className="mt-12" />
            <PrintPermalink path={postPath(post)} className="mt-12" />
          </div>
        </div>
      </Container>

      {/* The register's entries about the place this post was tagged with, so a
          reader can go from the writing to the record it summarises. Decided by
          the writer's tag, never by matching the text (src/lib/places.ts). */}
      {registerEntries.length > 0 ? (
        <Container width="reading" className="mt-5">
          <StoryBox
            as="section"
            size="compact"
            level={2}
            kicker="The register"
            kickerTone="muted"
            title="Tracked in the register"
            footer={<TextLink href="/disruptions">Every open disruption</TextLink>}
          >
            <ul className="flex flex-col gap-2">
              {registerEntries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge status={entry.status} />
                  <TextLink href={`/disruptions/${entry.id}`}>{entry.title}</TextLink>
                </li>
              ))}
            </ul>
          </StoryBox>
        </Container>
      ) : null}

      <Container width="reading" className="mt-5">
        <SubscribePanel heading="Get the next briefing by email" />
      </Container>

      {previous || next ? (
        <Container width="reading" className="mt-5">
          {/* Hidden in print: both sides are links to pages a sheet of paper
              cannot reach. */}
          <nav aria-label={`More ${kind}s`} className="story story-compact print:hidden">
            {/* Position encodes direction: earlier on the left, later on the
                right. No arrow glyphs. */}
            <div className="grid gap-8 sm:grid-cols-2">
              <AdjacentPost post={previous} label={`Previous ${kind}`} align="start" />
              <AdjacentPost post={next} label={`Next ${kind}`} align="end" />
            </div>
          </nav>
        </Container>
      ) : null}
    </article>
  );
}

function AdjacentPost({
  post,
  label,
  align,
}: {
  post: IssueSummary | null;
  label: string;
  align: 'start' | 'end';
}) {
  if (!post) return <div aria-hidden="true" />;

  return (
    <div className={align === 'end' ? 'sm:text-right' : undefined}>
      <p className="text-meta text-muted">{label}</p>
      <Link
        href={postPath(post)}
        className="mt-1 inline-flex min-h-11 items-center text-[1.125rem] font-semibold text-fg transition-colors hover:text-link"
      >
        {post.title}
      </Link>
    </div>
  );
}

/**
 * Post images come from whatever CDN the sending platform uses, and that host
 * changes without notice. Routing them through next/image would require a
 * remotePatterns allowlist that fails silently the day the host changes, so
 * they stay plain <img> with native lazy loading. The lint rule is disabled
 * here and nowhere else.
 */
function CoverImage({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="w-full border border-hairline"
    />
  );
}
