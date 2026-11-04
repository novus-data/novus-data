import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ActionLink } from '@/components/action';
import { ChokepointMap } from '@/components/chokepoint-map';
import { CreditedPhoto } from '@/components/credited-photo';
import { Container } from '@/components/container';
import { JsonLd } from '@/components/json-ld';
import { SeverityMeter } from '@/components/severity-legend';
import { SignInPanel } from '@/components/sign-in-panel';
import { StatusBadge } from '@/components/status-badge';
import { SectionLabel, StoryBox } from '@/components/story-box';
import { SubscribePanel } from '@/components/subscribe-panel';
import { TextLink } from '@/components/text-link';
import { coverageTopics } from '@/config/coverage';
import { articlesEnabled, monitorEnabled } from '@/config/launch';
import { formatAuthorNames, publication } from '@/config/publication';
import type { DisruptionSummary, EntityExposure } from '@/lib/disruptions';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  buildExposureMatrix,
  listDisruptions,
  worstAsOf,
} from '@/lib/disruptions';
import type { IssueSummary } from '@/lib/content';
import { listArticles, listIssues } from '@/lib/content';
import { absoluteUrl, accountsConfigured } from '@/lib/env';
import { formatIssueLabel, formatShortDate } from '@/lib/format';
import type { Photo } from '@/lib/photos';
import { getPhotoForPlaces } from '@/lib/photos';
import { publicationJsonLd } from '@/lib/structured-data';

/**
 * A box that spans the whole band. `Band` is two columns at `md` and twelve at
 * `lg`, so a full-width box has to say so at both, or between 768 and 1023px it
 * takes half the row and leaves the other half empty.
 */
const FULL_WIDTH = 'md:col-span-2 lg:col-span-12';

export const metadata: Metadata = {
  title: publication.name,
  description: publication.description,
  alternates: { canonical: absoluteUrl('/') },
};

/**
 * The front page, laid out the way a paper lays out its own: a nameplate, a
 * lead story with a rail beside it, then bands of boxed stories.
 *
 * The lead is chosen, never written by hand: the most pressing open register
 * entry if there is one, otherwise the latest briefing, otherwise the case for
 * the publication itself. Every figure on the page is counted from the
 * register at build time, and a band with nothing real in it does not render.
 */
export default async function HomePage() {
  const [disruptions, briefings, matrix, articles] = await Promise.all([
    listDisruptions(),
    listIssues(),
    buildExposureMatrix(),
    articlesEnabled ? listArticles() : Promise.resolve([]),
  ]);
  const analysis = articles.slice(0, 3);

  const open = disruptions.filter((entry) => entry.status !== 'resolved');
  const [lead, ...rest] = open;
  const latestIssue = briefings[0] ?? null;
  // The case for the site leads only while there is no real story to lead with.
  const explainerLeads = !lead && !latestIssue;

  const counts = registerCounts(disruptions, matrix.rows.length);

  // The lead's photo, if the site has a licensed one of the place the entry is
  // about. Found through the entry's `places`, so it needs no hand-edit; an
  // entry about somewhere with no photo simply leads without one (Rule 3: a
  // photo has to show what the text is about).
  const leadPhoto = lead ? await getPhotoForPlaces(lead.places) : null;

  // The two dates the nameplate prints. Both are read from the data, so they
  // move with the register and the archive and nothing is typed by hand.
  const registerReviewed =
    disruptions
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return (
    <>
      <JsonLd data={publicationJsonLd()} />

      <Nameplate
        registerReviewed={registerReviewed}
        latestBriefing={latestIssue?.publishedAt ?? null}
      />

      {/* A reader on a phone sees only the lead on the first screen, so the
          way in sits above it, as one slim row. The full panel stays at the
          foot of the page. */}
      <Container className="mt-5">
        <SubscribePanel strip />
      </Container>

      <Container className="mt-4">
        <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
          {lead ? (
            <LeadDisruption disruption={lead} photo={leadPhoto} className="lg:col-span-8" />
          ) : latestIssue ? (
            <LeadIssue issue={latestIssue} className="lg:col-span-8" />
          ) : (
            <Explainer size="lead" className="lg:col-span-8" />
          )}

          {/* The rail beside the lead, as a paper keeps one: the newest briefing,
              the other open entries, then what the publication is for. Each is
              derived, so the rail grows and shrinks with the register and the
              archive, and none of it is typed by hand. */}
          <div className="flex flex-col gap-4 lg:col-span-4">
            {latestIssue && lead ? <LatestBriefing issue={latestIssue} /> : null}
            {rest.length > 0 ? <AlsoOpen disruptions={rest.slice(0, 4)} /> : null}
            <StoryBox as="aside" size="compact" level={2} kicker="What it is for" kickerTone="muted">
              <p className="text-[1.0625rem] font-medium leading-snug text-fg">
                {publication.mission}
              </p>
            </StoryBox>
            {/* Only once accounts are live: before then it would advertise
                something no reader can use. */}
            {accountsConfigured() ? <SignInPanel enabled /> : null}
          </div>
        </div>
      </Container>

      <Band id="chokepoints" label="Chokepoints">
        <StoryBox
          className={FULL_WIDTH}
          kicker="Locator"
          title="The straits and canals we watch"
          footer={<TextLink href="/disruptions">Open the register</TextLink>}
        >
          {/* Articles reach the map only while /articles is switched on, so a
              card never links to a page that 404s. */}
          <ChokepointMap disruptions={disruptions} posts={[...briefings, ...articles]} />
        </StoryBox>
      </Band>

      {matrix.rows.length > 0 ? (
        <Band id="exposure" label="Exposure">
          <MostExposed rows={matrix.rows.slice(0, 6)} className={FULL_WIDTH} />
        </Band>
      ) : null}

      {analysis.length > 0 ? (
        <Band id="writing" label="Writing">
          <LatestAnalysis posts={analysis} className={FULL_WIDTH} />
        </Band>
      ) : null}

      <Band id="inside" label="Inside Novus Data">
        {explainerLeads ? null : <Explainer size="standard" className={FULL_WIDTH} />}

        <StoryBox
          className="lg:col-span-7"
          kicker="The register"
          title="What is going wrong in physical trade, dated and sourced"
          titleHref="/disruptions"
          footer={
            <>
              <TextLink href="/disruptions">Open the register</TextLink>
              {counts ? <span>{counts.register}</span> : null}
            </>
          }
        >
          <p>One entry per problem, each with its sources, status and last review date.</p>
        </StoryBox>

        <StoryBox
          className="lg:col-span-5"
          kicker="The exposure chart"
          title="Which companies each problem reaches, and how"
          titleHref="/exposure"
          footer={
            <>
              <TextLink href="/exposure">Open the chart</TextLink>
              {counts ? <span>{counts.names}</span> : null}
            </>
          }
        >
          <p>An assessment appears only with its mechanism, confidence, date and source.</p>
        </StoryBox>

        {/* Gated off for launch (src/config/launch.ts). A link, not a live
            panel: reading the feeds here would put the home page on the
            monitor's fifteen-minute regeneration cycle too. */}
        {monitorEnabled ? (
          <StoryBox
            className="lg:col-span-5"
            kicker="The monitor"
            title="What is changing now, from public feeds"
            titleHref="/monitor"
            footer={<TextLink href="/monitor">Open the monitor</TextLink>}
          >
            <p>
              Where news reporting of strikes, blockades, sanctions and fighting is running above
              its own normal, set beside natural hazards, port wind and energy prices, and re-read
              every fifteen minutes. Every reading shows the time its source produced it, and a
              feed that fails says so.
            </p>
          </StoryBox>
        ) : null}

      </Band>

      <Band id="more" label="Coverage and what comes next">
        <StoryBox
          className={FULL_WIDTH}
          kicker="Coverage"
          title="What Novus Data watches"
          titleHref="/coverage"
          footer={<TextLink href="/coverage">Why each of these matters</TextLink>}
        >
          <ul className="grid max-w-none gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {coverageTopics.map((topic) => (
              <li key={topic.id} className="border-t border-hairline py-2 text-fg">
                {topic.title}
              </li>
            ))}
          </ul>
        </StoryBox>

        {/* The subscribe panel leads and is the wider box: it is the thing the
            site asks a reader to do. The alerts box is a product that does not
            exist yet, so it is the narrower one and says so. */}
        <SubscribePanel
          level={3}
          heading={`Subscribe to ${publication.newsletter.name}`}
          className="md:col-span-2 lg:col-span-8"
        />

        <StoryBox
          className="md:col-span-2 lg:col-span-4"
          kicker="In development"
          title={publication.alerts.name}
          titleHref="/alerts"
          footer={<TextLink href="/alerts">What it will and will not do</TextLink>}
        >
          <p>A notification when a disruption you follow opens or escalates. No release date yet.</p>
        </StoryBox>
      </Band>

      {formatAuthorNames() ? (
        <Container className="mt-10">
          <p className="border-t border-hairline pt-5 text-meta text-muted">
            Novus Data is written by {formatAuthorNames()}.{' '}
            <TextLink href="/about">How it is produced</TextLink>.
          </p>
        </Container>
      ) : null}
    </>
  );
}

/**
 * The front page's name, set as a paper sets its nameplate: large, closed by
 * a double rule, with the strapline beneath. It is the page's h1.
 *
 * The right-hand line is a dateline: when the register was last reviewed and
 * when the latest briefing went out. Both are absolute dates read from the
 * data, never "today" or "N days ago", because the page is static and a
 * relative date would freeze at build and only ever understate its age (§6a).
 * With neither date to print it falls back to "Free to read".
 */
function Nameplate({
  registerReviewed,
  latestBriefing,
}: {
  registerReviewed: string | null;
  latestBriefing: string | null;
}) {
  const reviewed = registerReviewed ? formatShortDate(registerReviewed) : null;
  const briefed = latestBriefing ? formatShortDate(latestBriefing) : null;

  return (
    <Container className="pt-8 sm:pt-12">
      <div className="border-b-[6px] border-double border-accent pb-3 sm:pb-4">
        <h1 className="text-[clamp(2.5rem,1.75rem+3.4vw,3.75rem)] font-bold leading-[0.95] tracking-[-0.04em] text-fg">
          {publication.name}
        </h1>
      </div>
      <div className="flex flex-col gap-1 border-b border-hairline py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <p className="text-[0.9375rem] text-muted">{publication.shortDescription}</p>
        <p className="text-meta text-muted">
          {reviewed || briefed ? (
            <>
              {/* Each half stays on one line; the break, if there is one,
                  falls between them rather than inside a date. */}
              {reviewed ? (
                <span className="whitespace-nowrap">
                  Register reviewed <time dateTime={registerReviewed ?? undefined}>{reviewed}</time>
                </span>
              ) : null}
              {reviewed && briefed ? <span aria-hidden="true"> &middot; </span> : null}
              {briefed ? (
                <span className="whitespace-nowrap">
                  Latest briefing <time dateTime={latestBriefing ?? undefined}>{briefed}</time>
                </span>
              ) : null}
            </>
          ) : (
            'Free to read'
          )}
        </p>
      </div>
    </Container>
  );
}

/** A band of boxes opened by a section label. */
function Band({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Container className="mt-10 sm:mt-12">
      <section aria-labelledby={id}>
        <SectionLabel id={id}>{label}</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-12 [&>*]:min-w-0">
          {children}
        </div>
      </section>
    </Container>
  );
}

/** The case for the publication: the lead when nothing else is, a box when something is. */
function Explainer({ size, className }: { size: 'lead' | 'standard'; className?: string }) {
  return (
    <StoryBox
      size={size}
      level={2}
      className={className}
      kicker="Why Novus Data exists"
      title={publication.openingLine}
      deck={publication.openingBody}
      footer={size === 'lead' ? <TextLink href="/disruptions">Open the register</TextLink> : undefined}
    />
  );
}

/**
 * The most pressing open disruption leads, exactly as a front page leads with
 * its biggest story. It refreshes itself from the register with no hand-edit.
 */
function LeadDisruption({
  disruption,
  photo,
  className,
}: {
  disruption: DisruptionSummary;
  photo: Photo | null;
  className?: string;
}) {
  const updated = formatShortDate(disruption.updatedAt);

  return (
    <StoryBox
      size="lead"
      level={2}
      className={className}
      kicker={`Leading the register · ${CATEGORY_LABELS[disruption.category]}`}
      title={disruption.title}
      titleHref={`/disruptions/${disruption.id}`}
      deck={disruption.summary}
      footer={
        <>
          <StatusBadge status={disruption.status} />
          {updated ? (
            <span>
              Reviewed <time dateTime={disruption.updatedAt}>{updated}</time>
            </span>
          ) : null}
          <span className="flex basis-full flex-wrap gap-3 pt-1">
            <ActionLink href={`/disruptions/${disruption.id}`} variant="secondary">
              Read the analysis
            </ActionLink>
            {disruption.exposures.length > 0 ? (
              <ActionLink href="/exposure" variant="quiet">
                See who it reaches
              </ActionLink>
            ) : null}
          </span>
        </>
      }
    >
      {photo ? (
        <CreditedPhoto photo={photo} priority sizes="(min-width: 1024px) 700px, 100vw" />
      ) : null}
    </StoryBox>
  );
}

/** Register empty but the briefing has shipped: lead with the latest issue. */
function LeadIssue({ issue, className }: { issue: IssueSummary; className?: string }) {
  const date = formatShortDate(issue.publishedAt);

  return (
    <StoryBox
      size="lead"
      level={2}
      className={className}
      kicker={`Latest briefing${formatIssueLabel(issue.issueNumber) ? ` · Issue ${formatIssueLabel(issue.issueNumber)}` : ''}`}
      title={issue.title}
      titleHref={`/briefings/${issue.slug}`}
      deck={issue.excerpt ?? undefined}
      footer={
        <>
          {date ? <time dateTime={issue.publishedAt}>{date}</time> : null}
          <span className="flex basis-full pt-1">
            <ActionLink href={`/briefings/${issue.slug}`} variant="secondary">
              Read this briefing
            </ActionLink>
          </span>
        </>
      }
    />
  );
}

/**
 * The other open entries, as headlines for the rail: status, title, and the
 * facts that say how current and how far-reaching each one is. The summary
 * lives on the entry's own page and on /disruptions; a rail has no room for
 * three lines of it per entry.
 */
function AlsoOpen({ disruptions }: { disruptions: DisruptionSummary[] }) {
  return (
    <StoryBox
      size="compact"
      kicker="Also open"
      title="Other entries in the register"
      footer={<TextLink href="/disruptions">The full register</TextLink>}
    >
      <ul className="story-list max-w-none">
        {disruptions.map((disruption) => {
          const reviewed = formatShortDate(disruption.updatedAt);
          const names = disruption.exposures.length;

          return (
            <li key={disruption.id} className="py-3 first:pt-0">
              <Link href={`/disruptions/${disruption.id}`} className="group block">
                <StatusBadge status={disruption.status} />
                <span className="mt-2 block text-[1rem] font-semibold leading-snug text-fg transition-colors group-hover:text-link">
                  {disruption.title}
                </span>
                <span className="mt-1 block text-meta">
                  {reviewed ? (
                    <>
                      Reviewed <time dateTime={disruption.updatedAt}>{reviewed}</time>
                      <span aria-hidden="true"> &middot; </span>
                    </>
                  ) : null}
                  <span data-numeric>{names}</span> {names === 1 ? 'name' : 'names'} affected
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </StoryBox>
  );
}

function MostExposed({ rows, className }: { rows: EntityExposure[]; className?: string }) {
  return (
    <StoryBox
      className={className}
      kicker="Most exposed"
      title="Names the open register reaches"
      footer={
        <>
          <TextLink href="/exposure">The full exposure chart</TextLink>
          <TextLink href="/about#method">How these assessments are made</TextLink>
        </>
      }
    >
      {/* Three columns from `lg`, two from `sm`: a full-width box with one
          narrow column of rows in it was most of a screen of white. */}
      <ul className="grid max-w-none gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <ExposureRow key={row.entity.id} row={row} />
        ))}
      </ul>
    </StoryBox>
  );
}

function ExposureRow({ row }: { row: EntityExposure }) {
  const asOf = worstAsOf([...row.byDisruption.values()]);

  return (
    <li className="border-t border-hairline py-3">
      <Link href={`/entities/${row.entity.id}`} className="group block">
        <span className="block text-[1.0625rem] leading-snug text-fg transition-colors group-hover:text-link">
          {row.entity.name}
        </span>
        <span className="mt-0.5 block text-meta">
          {row.entity.ticker ? `${row.entity.ticker} · ` : ''}
          {row.entity.sector}
          <span aria-hidden="true"> &middot; </span>
          <span data-numeric>{row.count}</span> {row.count === 1 ? 'disruption' : 'disruptions'}
        </span>
        <span className="mt-1.5 flex items-center gap-2.5 text-meta">
          <SeverityMeter severity={row.worstSeverity} />
          <span>
            {SEVERITY_LABELS[row.worstSeverity]}
            {asOf && formatShortDate(asOf) ? ` as of ${formatShortDate(asOf)}` : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The newest briefing, for the rail. Shown only while something else leads the
 * page; when the briefing is the lead, repeating it here would say it twice.
 */
function LatestBriefing({ issue }: { issue: IssueSummary }) {
  const date = formatShortDate(issue.publishedAt);
  const number = formatIssueLabel(issue.issueNumber);

  return (
    <StoryBox
      size="compact"
      kicker="Latest briefing"
      title={issue.title}
      titleHref={`/briefings/${issue.slug}`}
      footer={
        <>
          {number ? <span data-numeric>Issue {number}</span> : null}
          {date ? <time dateTime={issue.publishedAt}>{date}</time> : null}
          <TextLink href="/briefings">Every issue</TextLink>
        </>
      }
    >
      {issue.excerpt ? <p>{issue.excerpt}</p> : null}
    </StoryBox>
  );
}

function LatestAnalysis({ posts, className }: { posts: IssueSummary[]; className?: string }) {
  return (
    <StoryBox
      className={className}
      kicker="Latest analysis"
      title="Articles and long-term reviews"
      titleHref="/articles"
      footer={<TextLink href="/articles">All articles and reviews</TextLink>}
    >
      <ul className="grid max-w-none gap-x-8 md:grid-cols-3">
        {posts.map((post) => (
          <li key={post.slug} className="border-t border-hairline py-3">
            <Link href={`/articles/${post.slug}`} className="group block">
              {formatShortDate(post.publishedAt) ? (
                <time dateTime={post.publishedAt} className="block text-meta">
                  {formatShortDate(post.publishedAt)}
                </time>
              ) : null}
              <span className="mt-1 block text-[1.0625rem] font-semibold text-fg transition-colors group-hover:text-link">
                {post.title}
              </span>
              {post.excerpt ? (
                <span className="mt-1 block text-[0.9375rem]">{post.excerpt}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </StoryBox>
  );
}

/**
 * The register's own counts, as short lines for the box footers. Every figure
 * is counted from real records at build time. Null when the register is empty:
 * a row of zeroes would be accurate and useless.
 */
function registerCounts(disruptions: DisruptionSummary[], entityCount: number) {
  if (disruptions.length === 0) return null;

  const active = disruptions.filter((entry) => entry.status === 'active').length;
  const lastReviewed = disruptions
    .map((entry) => entry.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const reviewed = lastReviewed ? formatShortDate(lastReviewed) : null;

  return {
    register: (
      <>
        <span data-numeric>{disruptions.length}</span> tracked ·{' '}
        <span data-numeric>{active}</span> active
        {reviewed ? (
          <>
            {' '}
            · last reviewed <time dateTime={lastReviewed}>{reviewed}</time>
          </>
        ) : null}
      </>
    ),
    names: (
      <>
        <span data-numeric>{entityCount}</span>{' '}
        {entityCount === 1 ? 'name on the chart' : 'names on the chart'}
      </>
    ),
  };
}
