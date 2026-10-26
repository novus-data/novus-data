import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container } from '@/components/container';
import { CreditedPhoto } from '@/components/credited-photo';
import { MancaleMap } from '@/components/mancale/mancale-map';
import { GapChart, NewsChart, ShipsChart, formatMultiple, formatPerDay, signed } from '@/components/mancale/mancale-charts';
import { PageHeader } from '@/components/page-header';
import { SourceList } from '@/components/source-list';
import { SubscribePanel } from '@/components/subscribe-panel';
import { SectionLabel, StoryBox } from '@/components/story-box';
import { TextLink } from '@/components/text-link';
import { mancaleEnabled } from '@/config/launch';
import { absoluteUrl } from '@/lib/env';
import { formatLongDate } from '@/lib/format';
import {
  MANCALE_METHOD,
  MANCALE_REGIME_LABELS,
  MANCALE_REGIME_MEANINGS,
  MANCALE_REGIMES,
  getMancale,
  type MancaleChokepoint,
  type MancaleWeek,
} from '@/lib/indicators';
import { getPhoto } from '@/lib/photos';

export const metadata: Metadata = {
  title: 'Mancalë Index',
  description:
    'Whether the news about seven shipping chokepoints is louder or quieter than their ship traffic justifies. Weekly, from IMF PortWatch and GDELT data.',
  alternates: { canonical: absoluteUrl('/mancale') },
};

/**
 * /mancale — the Mancalë Index. Static, like every reading page (§13).
 *
 * Everything on this page is computed at build time from
 * content/indicators/mancale.json, which holds only sourced weekly averages.
 * The method shown in "How it is calculated" is MANCALE_METHOD itself, so
 * the published method and the calculation are one object (§14a).
 *
 * Gated by `mancaleEnabled` (src/config/launch.ts): off, the route 404s and
 * the navigation does not link to it.
 */
export default async function MancalePage() {
  if (!mancaleEnabled) notFound();

  const [index, hero] = await Promise.all([getMancale(), getPhoto('mancale-hero')]);

  return (
    <>
      <PageHeader
        title="Mancalë Index"
        eyebrow={`Index · method v${MANCALE_METHOD.version}`}
        lede="Is the news about a shipping chokepoint louder or quieter than the ships passing through it justify? Measured each week for seven chokepoints, against a fixed 2019–22 normal."
      />

      {hero ? (
        <Container className="mt-6">
          <CreditedPhoto photo={hero} priority />
        </Container>
      ) : null}

      {!index ? (
        <Container className="mt-8">
          <StoryBox kicker="No data yet" title="The index has not been calculated">
            <p>
              There is no Mancalë data file in this build. It is written by <code>npm run mancale</code>; until then the page
              shows nothing rather than a placeholder.
            </p>
          </StoryBox>
        </Container>
      ) : (
        <>
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
            <Scoreboard chokepoints={index.chokepoints} weekStart={index.latestWeekStart} dataThrough={index.dataThrough} />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <HowToRead />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <SectionLabel id="chokepoints">The seven chokepoints, weekly since 2019</SectionLabel>
            {/* Map first in the markup, so it leads below lg; from lg it sits in a
                sticky right-hand column that stays in view while the charts scroll. */}
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
              <aside aria-label="Map of the seven chokepoints" className="lg:sticky lg:top-6 lg:order-2">
                <MancaleMap points={index.chokepoints.map((point) => ({ id: point.id, label: point.label, regime: point.latest.regime }))} />
              </aside>
              <div className="flex flex-col gap-5 lg:order-1">
                {index.chokepoints.map((point) => (
                  <ChokepointBox key={point.id} point={point} />
                ))}
              </div>
            </div>
          </Container>

          <Container className="mt-12 sm:mt-16">
            <Method />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <StoryBox
              size="compact"
              kicker="Scorecard"
              title="Do the labels tell you anything about what comes next?"
              footer={<TextLink href="/mancale/scorecard">Read the scorecard</TextLink>}
            >
              <p>
                The index describes the week; it does not forecast. The scorecard checks that in the open, with every call
                listed and the misses left on the page.
              </p>
            </StoryBox>
          </Container>
        </>
      )}

      <Container className="mt-12 sm:mt-16">
        <SubscribePanel heading="Get the briefing by email" className="max-w-reading" />
      </Container>
    </>
  );
}

function reading(week: MancaleWeek): string {
  return MANCALE_REGIME_LABELS[week.regime];
}

function Scoreboard({
  chokepoints,
  weekStart,
  dataThrough,
}: {
  chokepoints: MancaleChokepoint[];
  weekStart: string;
  dataThrough: string;
}) {
  const retrieved = [...new Set(chokepoints.flatMap((point) => point.sources.map((source) => `${source.publisher}, retrieved ${formatLongDate(source.retrievedAt)}`)))];
  return (
    <StoryBox
      level={2}
      kicker={<>Week of <time dateTime={weekStart}>{formatLongDate(weekStart)}</time></>}
      title="This week"
      deck={
        <p className="text-muted">
          Ship data through <time dateTime={dataThrough}>{formatLongDate(dataThrough)}</time>. Against the 2019–22
          normal. A gap of +2 or more means the news is ahead of the ships; −2 or less, the ships are ahead of the news.
        </p>
      }
      footer={<span>Sources: {retrieved.join('; ')}. Weekly averages and scores calculated by Novus Data.</span>}
    >
      {/* A real table from md up: the values are what matters, and it is the
          table view for every chart below. Read down as a list below md. */}
      <table className="hidden w-full text-left md:table">
        <thead className="text-meta text-muted">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 pr-3 font-semibold">Chokepoint</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Ships vs normal</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">News vs normal</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Attention</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Flow stress</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Gap</th>
            <th scope="col" className="py-2 font-semibold">Reading</th>
          </tr>
        </thead>
        <tbody>
          {chokepoints.map((point) => {
            const week = point.latest;
            return (
              <tr key={point.id} className="border-b border-hairline align-baseline">
                <th scope="row" className="py-2.5 pr-3 font-normal">
                  <TextLink href={`#${point.id}`}>{point.label}</TextLink>
                </th>
                <td data-numeric className="py-2.5 pr-3 text-right">{signed(week.flowVsBaselinePct)}%</td>
                <td data-numeric className="py-2.5 pr-3 text-right">
                  {week.newsXBaseline === null ? <span className="text-muted">not collected</span> : formatMultiple(week.newsXBaseline)}
                </td>
                <td data-numeric className="py-2.5 pr-3 text-right">{week.attention === null ? '—' : week.attention.toFixed(1)}</td>
                <td data-numeric className="py-2.5 pr-3 text-right">{week.flowStress.toFixed(1)}</td>
                <td data-numeric className="py-2.5 pr-3 text-right font-semibold">{week.gap === null ? '—' : signed(week.gap, 2)}</td>
                <td className="py-2.5 text-[0.9375rem]">{reading(week)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="flex flex-col md:hidden">
        {chokepoints.map((point) => {
          const week = point.latest;
          return (
            <li key={point.id} className="border-b border-hairline py-3">
              <p className="flex items-baseline justify-between gap-3">
                <TextLink href={`#${point.id}`}>{point.label}</TextLink>
                <span className="text-meta text-fg">{reading(week)}</span>
              </p>
              <p data-numeric className="mt-1 text-meta text-muted">
                Ships {signed(week.flowVsBaselinePct)}% · News{' '}
                {week.newsXBaseline === null ? 'not collected' : formatMultiple(week.newsXBaseline)} · Gap{' '}
                {week.gap === null ? '—' : signed(week.gap, 2)}
              </p>
            </li>
          );
        })}
      </ul>
    </StoryBox>
  );
}

function HowToRead() {
  const m = MANCALE_METHOD;
  return (
    <StoryBox as="section" level={2} id="how-to-read" kicker="How to read it" title="Two scores and the gap between them">
      <ol className="flex flex-col gap-4">
        <li>
          <p className="text-fg">
            <strong>Flow stress, 0 to {m.cap}.</strong> How unusually few ships passed through the chokepoint that week,
            compared with its normal. Only traffic below normal counts.
          </p>
        </li>
        <li>
          <p className="text-fg">
            <strong>Attention, 0 to {m.cap}.</strong> How unusually much of the world&rsquo;s English-language news
            mentioned the chokepoint that week, compared with its normal. Only coverage above normal counts.
          </p>
        </li>
        <li>
          <p className="text-fg">
            <strong>The gap is attention minus flow stress.</strong> For both scores, 0 is normal, 2 is clearly abnormal
            and {m.cap} is extreme.
          </p>
        </li>
      </ol>

      {/* The label scale, in words first: position and text carry the meaning,
          the tint only groups it. */}
      <div className="mt-6 grid grid-cols-1 border border-rule sm:grid-cols-3" role="list" aria-label="What the gap means">
        {[
          { range: `${signed(m.realityLedAt)} or less`, regime: 'reality-led' as const },
          { range: `${signed(m.realityLedAt)} to ${signed(m.narrativeLedAt)}`, regime: 'aligned' as const },
          { range: `${signed(m.narrativeLedAt)} or more`, regime: 'narrative-led' as const },
        ].map((zone, position) => (
          <div
            key={zone.regime}
            role="listitem"
            className={`flex flex-col gap-1 p-4 ${position > 0 ? 'border-t border-rule sm:border-l sm:border-t-0' : ''} ${zone.regime === 'aligned' ? 'bg-surface-2' : ''}`}
          >
            <p data-numeric className="text-meta text-muted">Gap {zone.range}</p>
            <p className="font-semibold text-fg">{MANCALE_REGIME_LABELS[zone.regime]}</p>
            <p className="text-[0.9375rem] text-muted">{MANCALE_REGIME_MEANINGS[zone.regime]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-meta text-muted">
        A week where both scores are below {m.quietBelow} is labelled {MANCALE_REGIME_LABELS.quiet.toLowerCase()}. Where
        news volume has not been collected yet, the week is described by ship traffic alone and has no gap.
      </p>
    </StoryBox>
  );
}

function ChokepointBox({ point }: { point: MancaleChokepoint }) {
  const m = MANCALE_METHOD;
  const week = point.latest;
  const news =
    week.newsXBaseline === null
      ? 'News volume has not been collected for this chokepoint yet.'
      : `news coverage ${formatMultiple(week.newsXBaseline)} its normal. Gap ${signed(week.gap ?? 0, 2)}.`;
  return (
    <StoryBox
      as="section"
      level={3}
      id={point.id}
      kicker={reading(week)}
      title={point.label}
      deck={
        <p className="text-muted">
          Week of {formatLongDate(week.weekStart)}: {formatPerDay(week.transitsPerDay)} ships a day,{' '}
          {signed(week.flowVsBaselinePct)}% against a normal of {formatPerDay(point.baselineTransitsPerDay)}
          {week.newsXBaseline === null ? '. ' : '; '}
          {news} {point.weeksInRegime > 1 ? `${reading(week)} for ${point.weeksInRegime} weeks.` : ''}
        </p>
      }
      footer={<SourceList compact sources={point.sources} />}
    >
      <div className="flex flex-col gap-6">
        <ShipsChart weeks={point.weeks} label={point.label} />
        {point.hasNews ? (
          <>
            <NewsChart weeks={point.weeks} label={point.label} />
            <GapChart weeks={point.weeks} label={point.label} narrativeLedAt={m.narrativeLedAt} realityLedAt={m.realityLedAt} cap={m.cap} />
          </>
        ) : null}
        <p className="text-meta text-muted">
          <span className="text-fg">Read with care: </span>
          {point.note}
        </p>
      </div>
    </StoryBox>
  );
}

function Method() {
  const m = MANCALE_METHOD;
  return (
    <StoryBox
      as="section"
      level={2}
      id="method"
      kicker={`Method v${m.version}`}
      title="How it is calculated"
      footer={
        <span>
          Mancalë is Quenya, one of J. R. R. Tolkien&rsquo;s Elvish languages, for &ldquo;commerce&rdquo;. Novus Data
          publishes analysis and commentary, not investment advice.
        </span>
      }
    >
      <dl className="flex flex-col gap-4">
        <div>
          <dt className="text-meta text-fg">Inputs</dt>
          <dd className="mt-1">
            Ship traffic is the mean number of vessels crossing each chokepoint per day, by week, from IMF PortWatch,
            which counts ships from their location signals. News volume is the mean daily share of all English-language
            news monitored by the GDELT Project that matches each chokepoint&rsquo;s query, by week. Weeks run Monday to
            Sunday.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Normal</dt>
          <dd className="mt-1">
            Every week ending on or before {formatLongDate(m.baselineEnd)}. It is fixed: it is never re-estimated, so a
            long disruption cannot gradually become the new normal.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Scores</dt>
          <dd className="mt-1">
            Each week is compared with normal using the median and the median absolute deviation (×1.4826), which a few
            extreme weeks cannot drag about. News is compared on a log scale. Flow stress counts only traffic below
            normal and attention only coverage above it; both are capped at {m.cap}. The scale cannot fall below{' '}
            {m.flowScaleFloor * 100}% of normal traffic, or {m.newsScaleFloor} log units of news, so a very steady
            series cannot make a small change look large.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Labels</dt>
          <dd className="mt-1">
            <ul className="flex flex-col gap-1.5">
              {MANCALE_REGIMES.map((regime) => (
                <li key={regime}>
                  <span className="text-fg">{MANCALE_REGIME_LABELS[regime]}.</span> {MANCALE_REGIME_MEANINGS[regime]}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">What it is not</dt>
          <dd className="mt-1">
            It describes; it does not forecast. Ship counts are modelled from location signals and undercount ships that
            switch them off. The news measure counts articles that mention a place, including in passing. The index is
            not seasonally adjusted. The thresholds are judgement calls, published here so they can be checked. The
            figures are refreshed weekly; if they fall more than {m.staleAfterDays} days behind, this page says so.
          </dd>
        </div>
      </dl>
    </StoryBox>
  );
}
