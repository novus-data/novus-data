import type { Metadata } from 'next';

import { Container } from '@/components/container';
import { JsonLd } from '@/components/json-ld';
import { PageHeader } from '@/components/page-header';
import { StoryBox } from '@/components/story-box';
import { MailLink, TextLink } from '@/components/text-link';
import { mancaleEnabled } from '@/config/launch';
import { publication } from '@/config/publication';
import { STALE_AFTER_DAYS, listDisruptions } from '@/lib/disruptions';
import { absoluteUrl, env } from '@/lib/env';
import { registerDatasetJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Data and downloads',
  description:
    'The Novus Data disruption register as a spreadsheet and as a JSON feed: every assessment with its mechanism, confidence, date and sources.',
  alternates: { canonical: absoluteUrl('/data') },
};

/**
 * /data — what the register publishes in machine-readable form, and the terms
 * it is offered on.
 *
 * It states no figure (Rule 1): no count of entries, sources or names, because
 * a number on a page about data reads as a claim about coverage. The files
 * themselves are the evidence. Everything listed here is already public and
 * statically built; this page adds no data and stores nothing.
 */
export default async function DataPage() {
  // The register's own dates, for the Dataset markup (structured-data.ts).
  // Read from the entries, so they move with the register and nothing here is
  // typed by hand.
  const entries = await listDisruptions();
  const earliestStart = entries.map((entry) => entry.startedAt).filter(Boolean).sort()[0] ?? null;
  const latestReview = entries.map((entry) => entry.updatedAt).filter(Boolean).sort().at(-1) ?? null;

  return (
    <>
      <JsonLd data={registerDatasetJsonLd({ earliestStart, latestReview })} />
      <PageHeader
        width="reading"
        title="Data and downloads"
        lede="The register in machine-readable form: what is published, how fresh it is, and how to cite it."
      />

      <Container width="reading" className="mt-8 flex flex-col gap-5">
        <StoryBox
          as="section"
          level={2}
          id="what"
          kicker="The record"
          kickerTone="muted"
          title="What the register is"
          footer={<TextLink href="/about#method">The published standard of proof</TextLink>}
        >
          <p>
            Each entry in the register is one problem in physical trade: a chokepoint, a port, a
            trade measure, an input, energy, labour or weather. It carries a status, the date it
            began, the date it was last reviewed and the sources behind it.
          </p>
          <p>
            Each assessment sets one entry against one company or sector, and states how the
            problem reaches it, how hard it lands, how well established that is and when it was
            last true, with at least one source you can follow. An assessment missing any of
            those is refused by the code that builds the site. There is no composite score
            anywhere in the data.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="downloads" kicker="Downloads" kickerTone="muted" title="Files and feeds">
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="font-medium">
                <TextLink href="/register.csv">register.csv</TextLink>
              </dt>
              <dd className="mt-1 text-muted">
                The register as a spreadsheet, one row per assessment. Mechanism, confidence,
                severity, as-of date and sources each have their own column, so a row keeps its
                provenance wherever it is pasted. Entries with no assessment yet still appear,
                with the company columns empty.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                <TextLink href="/register.json">register.json</TextLink>
              </dt>
              <dd className="mt-1 text-muted">
                A JSON Feed of every entry with its status, review date and the companies and
                sectors it reaches. Items are current state, not an event log: keep the last{' '}
                <code>date_modified</code> you saw for each <code>id</code> and compare.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                <TextLink href="/feed.json">feed.json</TextLink>
              </dt>
              <dd className="mt-1 text-muted">
                Everything written for the site, briefings and articles, as a JSON Feed with
                summaries and links.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                <TextLink href="/rss.xml">rss.xml</TextLink>
              </dt>
              <dd className="mt-1 text-muted">
                The same list of briefings and articles as RSS, for feed readers that do not
                read JSON Feed.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Permanent pages</dt>
              <dd className="mt-1 text-muted">
                Every entry has its own address under <TextLink href="/disruptions">/disruptions</TextLink>{' '}
                and every company or sector under <TextLink href="/entities">/entities</TextLink>. An
                address does not change once published, and a resolved entry stays listed.
              </dd>
            </div>
          </dl>
        </StoryBox>

        <StoryBox as="section" level={2} id="freshness" kicker="Freshness" kickerTone="muted" title="How current it is">
          <p>
            The files are rebuilt every time the site is published, from the same records as the
            pages. Each row carries the date its entry was last reviewed and the date its
            assessment was last true. An entry not reviewed within{' '}
            <span data-numeric>{STALE_AFTER_DAYS}</span> days is marked as stale on its own page
            rather than presented as current, so read those dates before relying on a row.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="citing" kicker="Citing" kickerTone="muted" title="Citing and reusing">
          <p>
            Quote or cite any entry with a link to its page and its review date, for example:
            Novus Data, “Entry title”, disruption register, last reviewed [date], [address].
          </p>
          <p>
            For bulk, commercial or redistribution use of the register, ask first
            {env.contactEmail ? (
              <>
                {' '}at <MailLink email={env.contactEmail} />
              </>
            ) : (
              <>
                {' '}through the <TextLink href="/contact">contact page</TextLink>
              </>
            )}
            .
          </p>
        </StoryBox>

        {mancaleEnabled ? (
          <StoryBox
            as="section"
            level={2}
            id="mancale"
            kicker="Mancalë Index"
            kickerTone="muted"
            title="Not in these files"
            footer={<TextLink href="/mancale#method">How the index is calculated</TextLink>}
          >
            <p>
              The Mancalë Index is calculated by Novus Data from IMF PortWatch ship data and GDELT
              news data, and published on its own pages with its method and sources. It is not
              part of these downloads, and reuse of its figures is subject to those sources’ terms
              as well as this site’s.
            </p>
          </StoryBox>
        ) : null}
      </Container>

      <Container width="reading" className="mt-8">
        <p className="max-w-measure text-meta text-muted">{publication.disclaimer}</p>
      </Container>
    </>
  );
}
