import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ChokepointBox, reading } from '@/components/mancale/chokepoint-box';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { StoryBox } from '@/components/story-box';
import { SubscribePanel } from '@/components/subscribe-panel';
import { TextLink } from '@/components/text-link';
import { mancaleEnabled } from '@/config/launch';
import { publication } from '@/config/publication';
import { absoluteUrl } from '@/lib/env';
import { formatLongDate } from '@/lib/format';
import { MANCALE_METHOD, getMancale } from '@/lib/indicators';

/**
 * /mancale/[id] — one chokepoint of the Mancalë Index on its own page.
 *
 * Why it exists: on `/mancale` all seven share one long page, so a reader
 * cannot send a colleague "the Hormuz reading" and have it open on Hormuz, and
 * a shared link cannot carry that chokepoint's own card (opengraph-image.tsx
 * beside this file). The page adds no data. It renders the same scored
 * chokepoint the index page renders, through the same component, so the two
 * cannot disagree (§14a).
 *
 * Static, like every reading page (§13). The routes are exactly the chokepoints
 * in content/indicators/mancale.json, so a new chokepoint arrives with the
 * weekly refresh and needs no edit here (Rule 6). Gated by `mancaleEnabled`
 * with the rest of the index: off, every route here 404s.
 */
export async function generateStaticParams() {
  if (!mancaleEnabled) return [];
  const index = await getMancale();
  return (index?.chokepoints ?? []).map((point) => ({ id: point.id }));
}

export const dynamicParams = false;

export async function generateMetadata(props: PageProps<'/mancale/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const index = mancaleEnabled ? await getMancale() : null;
  const point = index?.chokepoints.find((candidate) => candidate.id === id);
  if (!index || !point) return { title: 'Not found' };

  const title = `${point.label} · Mancalë Index`;
  // Words and dates only. A description travels in link previews, and a figure
  // there is read without the chart or the method beside it.
  const description = `${point.label}, week of ${formatLongDate(point.latest.weekStart)}: ${reading(point.latest)}. Ship traffic${
    point.hasNews ? ' and news coverage' : ''
  } against a fixed 2019–22 normal, from IMF PortWatch${point.hasNews ? ' and GDELT' : ''}.`;
  const url = absoluteUrl(`/mancale/${point.id}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    // A page's own openGraph and twitter replace the layout's whole objects, so
    // the fields the layout supplies are repeated here (see /mancale).
    openGraph: { type: 'website', siteName: publication.name, title, description, url, locale: 'en_GB' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function MancaleChokepointPage(props: PageProps<'/mancale/[id]'>) {
  if (!mancaleEnabled) notFound();

  const { id } = await props.params;
  const index = await getMancale();
  const point = index?.chokepoints.find((candidate) => candidate.id === id);
  if (!index || !point) notFound();

  const others = index.chokepoints.filter((candidate) => candidate.id !== point.id);

  return (
    <>
      <PageHeader
        title={point.label}
        eyebrow={
          <>
            <TextLink href="/mancale">Mancalë Index</TextLink> · method v{MANCALE_METHOD.version}
          </>
        }
        lede={
          point.hasNews
            ? 'Is the news about this chokepoint louder or quieter than the ships passing through it justify? Measured each week against a fixed 2019–22 normal.'
            : 'How far this chokepoint’s ship traffic is from its fixed 2019–22 normal, each week. News volume has not been collected for it yet, so it has no gap.'
        }
      />

      {index.staleAtBuild ? (
        <Container className="mt-8">
          <StoryBox size="compact" kicker="Not refreshed" kickerTone="muted">
            <p>
              These figures had not been refreshed when this page was built. The ship data runs to{' '}
              <time dateTime={index.dataThrough}>{formatLongDate(index.dataThrough)}</time>.
            </p>
          </StoryBox>
        </Container>
      ) : null}

      <Container className="mt-8">
        <ChokepointBox point={point} standalone />
      </Container>

      <Container className="mt-12 sm:mt-16">
        <StoryBox
          as="section"
          size="compact"
          level={2}
          kicker="Other chokepoints"
          title="The same reading elsewhere"
          footer={
            <>
              <TextLink href="/mancale">The full index</TextLink>
              <TextLink href="/mancale#method">How it is calculated</TextLink>
              <TextLink href="/mancale/scorecard">The scorecard</TextLink>
            </>
          }
        >
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {others.map((other) => (
              <li key={other.id} className="flex items-baseline justify-between gap-3 border-t border-hairline py-2">
                <TextLink href={`/mancale/${other.id}`}>{other.label}</TextLink>
                <span className="text-meta text-muted">{reading(other.latest)}</span>
              </li>
            ))}
          </ul>
        </StoryBox>
      </Container>

      <Container className="mt-12 sm:mt-16">
        <SubscribePanel heading="Get the briefing by email" className="max-w-reading" />
      </Container>
    </>
  );
}
