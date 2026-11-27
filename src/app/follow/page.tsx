import type { Metadata } from 'next';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { StoryBox } from '@/components/story-box';
import { TextLink } from '@/components/text-link';
import { listEntities } from '@/lib/disruptions';
import { absoluteUrl } from '@/lib/env';
import { listIndustries, listPlaces } from '@/lib/follow';

export const metadata: Metadata = {
  title: 'Follow the register',
  description:
    'Follow a company, an industry, a chokepoint or the whole Novus Data disruption register in any feed reader. No account, and nothing stored about you.',
  alternates: { canonical: absoluteUrl('/follow') },
};

/**
 * /follow — the feeds a reader can follow, and exactly what makes one of them
 * show something new. The first working piece of Novus Data Alerts.
 *
 * States no figure (Rule 1): no count of feeds, names or places. The lists are
 * the evidence. Every link here is a static file; this page stores nothing,
 * so /privacy is unchanged (see src/lib/follow.ts for why).
 */
export default async function FollowPage() {
  const [entities, industries, places] = await Promise.all([listEntities(), listIndustries(), listPlaces()]);
  // A directory is scanned for a name, so alphabetical, not the chart's order.
  const byName = (a: (typeof entities)[number], b: (typeof entities)[number]) => a.entity.name.localeCompare(b.entity.name);
  const companies = entities.filter((p) => p.entity.kind === 'company').sort(byName);
  const sectors = entities.filter((p) => p.entity.kind === 'sector').sort(byName);

  return (
    <>
      <PageHeader
        width="reading"
        title="Follow the register"
        lede="Follow one company, one industry, one place or the whole register, and see when the record changes. No account, and nothing stored about you."
      />

      <Container width="reading" className="mt-8 flex flex-col gap-5">
        <StoryBox
          as="section"
          level={2}
          id="how"
          kicker="How it works"
          kickerTone="muted"
          title="A feed for every name the register tracks"
          footer={<TextLink href="/alerts">What Novus Data Alerts will add</TextLink>}
        >
          <p>
            Each link below is a feed. Paste it into a feed reader, or into any service that
            emails you a feed&rsquo;s new items, and you will see a new item when something a
            person wrote in the register changes:
          </p>
          <ul className="list-disc pl-5">
            <li>a new disruption reaches what you follow;</li>
            <li>a disruption changes status, for example from active to easing;</li>
            <li>on a company or sector feed, its assessment is revised: severity, confidence or the date it was last true;</li>
            <li>on the other feeds, a disruption&rsquo;s strongest severity changes, or it reaches a new company or sector.</li>
          </ul>
          <p>
            A review that changes none of those does not show up. Nothing is forecast or
            calculated: every item is a dated record with its sources one click away. Your feed
            reader keeps the list of what you follow, so this site never learns it.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="everything" kicker="Everything" kickerTone="muted" title="The whole register">
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="font-medium">
                <TextLink href="/disruptions/feed.xml">Every disruption (RSS)</TextLink>
              </dt>
              <dd className="mt-1 text-muted">One item per entry, for any feed reader.</dd>
            </div>
            <div>
              <dt className="font-medium">
                <TextLink href="/register.json">register.json</TextLink>
              </dt>
              <dd className="mt-1 text-muted">
                The same register as a JSON Feed with the companies each entry reaches, for building
                your own watcher. <TextLink href="/data">More on the data files</TextLink>.
              </dd>
            </div>
          </dl>
        </StoryBox>

        {places.length > 0 ? (
          <StoryBox as="section" level={2} id="places" kicker="Places" kickerTone="muted" title="Chokepoints, ports and industrial clusters">
            <FeedList
              items={places.map((place) => ({ key: place.id, label: place.name, href: `/follow/place/${place.id}/feed.xml` }))}
            />
          </StoryBox>
        ) : null}

        {industries.length > 0 ? (
          <StoryBox as="section" level={2} id="industries" kicker="Industries" kickerTone="muted" title="Industries">
            <FeedList
              items={industries.map((industry) => ({
                key: industry.slug,
                label: industry.name,
                href: `/follow/industry/${industry.slug}/feed.xml`,
              }))}
            />
          </StoryBox>
        ) : null}

        {companies.length > 0 ? (
          <StoryBox as="section" level={2} id="companies" kicker="Companies" kickerTone="muted" title="Companies">
            <FeedList
              items={companies.map(({ entity }) => ({
                key: entity.id,
                label: entity.ticker ? `${entity.name} (${entity.ticker})` : entity.name,
                href: `/entities/${entity.id}/feed.xml`,
                page: `/entities/${entity.id}`,
              }))}
            />
          </StoryBox>
        ) : null}

        {sectors.length > 0 ? (
          <StoryBox as="section" level={2} id="sectors" kicker="Sectors" kickerTone="muted" title="Sectors and groups">
            <FeedList
              items={sectors.map(({ entity }) => ({
                key: entity.id,
                label: entity.name,
                href: `/entities/${entity.id}/feed.xml`,
                page: `/entities/${entity.id}`,
              }))}
            />
          </StoryBox>
        ) : null}

        <p className="max-w-measure text-meta text-muted">
          Novus Data publishes analysis and commentary, not investment advice. A feed item that a
          disruption reaches a company is not a claim about that company&rsquo;s financial
          condition.
        </p>
      </Container>
    </>
  );
}

function FeedList({ items }: { items: Array<{ key: string; label: string; href: string; page?: string }> }) {
  return (
    <ul className="story-list grid max-w-none gap-x-8 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-baseline justify-between gap-3 py-2">
          {item.page ? (
            <TextLink href={item.page} className="no-underline hover:underline">
              {item.label}
            </TextLink>
          ) : (
            <span>{item.label}</span>
          )}
          <TextLink href={item.href} className="shrink-0 text-meta">
            Feed
          </TextLink>
        </li>
      ))}
    </ul>
  );
}
