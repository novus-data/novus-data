import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container } from '@/components/container';
import { signed } from '@/components/mancale/mancale-charts';
import { PageHeader } from '@/components/page-header';
import { SectionLabel, StoryBox } from '@/components/story-box';
import { TextLink } from '@/components/text-link';
import { mancaleEnabled } from '@/config/launch';
import { absoluteUrl } from '@/lib/env';
import { formatLongDate } from '@/lib/format';
import {
  MANCALE_METHOD,
  MANCALE_REGIME_LABELS,
  SCORECARD_METHOD,
  getMancaleScorecard,
  type Scorecard,
  type ScorecardCall,
  type ScorecardTestResult,
  type Tally,
} from '@/lib/indicators';

export const metadata: Metadata = {
  title: 'Mancalë scorecard',
  description:
    'Whether the Mancalë Index labels told a reader anything about the next four weeks. Every call is listed, with what followed, and the misses stay on the page.',
  alternates: { canonical: absoluteUrl('/mancale/scorecard') },
};

/**
 * /mancale/scorecard — what followed each of the index's two sharpest labels.
 *
 * Static, like every reading page (§13), and gated by the same `mancaleEnabled`
 * switch as /mancale: off, the route 404s. Everything on it is computed at
 * build time from content/indicators/mancale.json and the ledger,
 * content/indicators/mancale-ledger.json, by src/lib/indicators/
 * mancale-scorecard.ts. Nothing here is typed by hand, including every count.
 */
export default async function MancaleScorecardPage() {
  if (!mancaleEnabled) notFound();

  const result = await getMancaleScorecard();

  return (
    <>
      <PageHeader
        title="Mancalë scorecard"
        eyebrow={`Scorecard · method v${SCORECARD_METHOD.version}`}
        lede="The Mancalë Index describes; it does not forecast. This page checks whether its two sharpest labels told a reader anything about the next four weeks. Every call is listed, and the misses stay on the page."
      />

      {!result ? (
        <Container className="mt-8">
          <StoryBox kicker="No data yet" title="The scorecard has nothing to score">
            <p>
              There is no Mancalë data file in this build, so there is nothing to count. The page shows nothing rather than a
              placeholder.
            </p>
          </StoryBox>
        </Container>
      ) : (
        <>
          {result.index.staleAtBuild ? (
            <Container className="mt-8">
              <StoryBox size="compact" kicker="Not refreshed" kickerTone="muted">
                <p>
                  These counts had not been refreshed when this page was built. The ship data runs to{' '}
                  <time dateTime={result.index.dataThrough}>{formatLongDate(result.index.dataThrough)}</time>.
                </p>
              </StoryBox>
            </Container>
          ) : null}

          <Container className="mt-8">
            <Question />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <SectionLabel id="results">What followed</SectionLabel>
            <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
              {result.scorecard.tests.map((test) => (
                <TestBox key={test.test.id} test={test} firstRecordedWeek={result.scorecard.firstRecordedWeek} />
              ))}
            </div>
          </Container>

          <Container className="mt-12 sm:mt-16">
            <RecordedCalls scorecard={result.scorecard} />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <History scorecard={result.scorecard} />
          </Container>

          <Container className="mt-12 sm:mt-16">
            <Method dataThrough={result.index.dataThrough} />
          </Container>
        </>
      )}
    </>
  );
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

const TEST_COPY = {
  'ships-ahead': {
    lagging: 'attention',
    question: 'Did the news catch up?',
    outcome: 'Attention rose by at least 1 point',
    moved: 'the news caught up',
  },
  'news-ahead': {
    lagging: 'flow stress',
    question: 'Did the ships follow?',
    outcome: 'Flow stress rose by at least 1 point',
    moved: 'the ships followed',
  },
} as const;

function Question() {
  const m = SCORECARD_METHOD;
  return (
    <StoryBox
      as="section"
      level={2}
      id="question"
      kicker="The question"
      title="Does a label say anything about the next four weeks?"
      deck={
        <p className="text-muted">
          Each week the index gives a chokepoint two scores, flow stress and attention. When the gap between them is wide, one
          score is ahead of the other, and the label says which. The test is whether the score that is behind then caught up.
        </p>
      }
    >
      <ul className="flex flex-col gap-3">
        <li>
          After a week labelled <strong>{MANCALE_REGIME_LABELS['reality-led']}</strong>: did <strong>attention</strong> rise by
          at least {m.moveBy} point in any of the next {m.horizonWeeks} weeks? That is, did the news catch up with the ships?
        </li>
        <li>
          After a week labelled <strong>{MANCALE_REGIME_LABELS['narrative-led']}</strong>: did <strong>flow stress</strong>{' '}
          rise by at least {m.moveBy} point in any of the next {m.horizonWeeks} weeks? That is, did the ships follow the news?
        </li>
      </ul>
      <p className="mt-4 text-meta text-muted">
        A rate on its own means little, so each test is also run from every ordinary week, and a label is informative only if
        what followed it differs from that. The scorecard is not a trading signal. It checks the index; it does not extend it.
      </p>
    </StoryBox>
  );
}

function TallyRow({ label, tally, note }: { label: string; tally: Tally; note?: string }) {
  return (
    <tr className="border-b border-hairline align-baseline">
      <th scope="row" className="py-2.5 pr-3 text-left font-normal">
        {label}
        {note ? <span className="block text-meta text-muted">{note}</span> : null}
      </th>
      <td data-numeric className="py-2.5 pr-3 text-right">{tally.settled}</td>
      <td data-numeric className="py-2.5 pr-3 text-right">{tally.followed}</td>
      <td data-numeric className="py-2.5 text-right">
        {tally.rate === null ? (
          <span className="whitespace-nowrap text-muted">not shown</span>
        ) : (
          <>
            <span className="font-semibold">{pct(tally.rate)}</span>{' '}
            <span className="whitespace-nowrap text-muted">({pct(tally.low ?? 0)}–{pct(tally.high ?? 1)})</span>
          </>
        )}
      </td>
    </tr>
  );
}

function TestBox({ test, firstRecordedWeek }: { test: ScorecardTestResult; firstRecordedWeek: string | null }) {
  const copy = TEST_COPY[test.test.id];
  const label = MANCALE_REGIME_LABELS[test.test.regime];
  const waiting = test.recorded.pending + test.history.pending;
  return (
    <StoryBox
      as="section"
      level={3}
      id={test.test.id}
      kicker={`After “${label}”`}
      title={copy.question}
      deck={<p className="text-muted">{copy.outcome} in any of the next {SCORECARD_METHOD.horizonWeeks} weeks.</p>}
      footer={
        <span>
          Rates appear once {SCORECARD_METHOD.minCallsToRead} calls are settled. The range is a 95% Wilson interval.
          {waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'call is' : 'calls are'} still waiting for outcome weeks and ${waiting === 1 ? 'is' : 'are'} not counted.` : ''}
        </span>
      }
    >
      <table className="w-full text-left">
        <thead className="text-meta text-muted">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 pr-3 font-semibold">Where the call came from</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Calls</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Followed</th>
            <th scope="col" className="py-2 text-right font-semibold">Rate</th>
          </tr>
        </thead>
        <tbody>
          <TallyRow label="Recorded as it happened" tally={test.recorded} note="Written to the ledger before the outcome weeks" />
          <TallyRow label="Found afterwards" tally={test.history} note="In-sample: see the method" />
          <TallyRow label="Any ordinary week" tally={test.ordinary} note={`${copy.lagging === 'attention' ? 'Attention' : 'Flow stress'} below ${SCORECARD_METHOD.baselineStartsBelow} to start`} />
        </tbody>
      </table>
      {test.recorded.settled + test.recorded.pending === 0 ? (
        <p className="mt-4 text-meta text-muted">
          {firstRecordedWeek
            ? `Labels have been recorded since the week of ${formatLongDate(firstRecordedWeek)}, and none has yet been “${label}”.`
            : 'Nothing has been recorded yet.'}{' '}
          The first call recorded will be listed below with the day it was written.
        </p>
      ) : null}
    </StoryBox>
  );
}

function statusText(call: ScorecardCall): string {
  const copy = TEST_COPY[call.testId];
  if (call.status === 'followed') {
    return `Yes, in week ${call.weeksSeen} (${signed(call.bestMove, 1)}): ${copy.moved}`;
  }
  if (call.status === 'not-followed') {
    return `No. Largest rise ${signed(call.bestMove, 1)} in ${SCORECARD_METHOD.horizonWeeks} weeks`;
  }
  return `Waiting: ${call.weeksSeen} of ${SCORECARD_METHOD.horizonWeeks} weeks in`;
}

function CallRows({ calls, showRecorded }: { calls: ScorecardCall[]; showRecorded: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left">
        <thead className="text-meta text-muted">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 pr-3 font-semibold">Week of</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Chokepoint</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Label</th>
            {showRecorded ? <th scope="col" className="py-2 pr-3 font-semibold">Recorded</th> : null}
            <th scope="col" className="py-2 font-semibold">What followed</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={`${call.testId}-${call.chokepointId}-${call.weekStart}`} className="border-b border-hairline align-baseline">
              <td data-numeric className="py-2.5 pr-3 whitespace-nowrap">
                <time dateTime={call.weekStart}>{formatLongDate(call.weekStart)}</time>
              </td>
              <td className="py-2.5 pr-3">{call.chokepointLabel}</td>
              <td className="py-2.5 pr-3 text-[0.9375rem]">{MANCALE_REGIME_LABELS[call.testId === 'ships-ahead' ? 'reality-led' : 'narrative-led']}</td>
              {showRecorded ? (
                <td data-numeric className="py-2.5 pr-3 whitespace-nowrap">
                  {call.recordedOn ? <time dateTime={call.recordedOn}>{formatLongDate(call.recordedOn)}</time> : '—'}
                </td>
              ) : null}
              <td className="py-2.5 text-[0.9375rem]">{statusText(call)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordedCalls({ scorecard }: { scorecard: Scorecard }) {
  const calls = scorecard.tests.flatMap((test) => test.calls.filter((call) => call.origin === 'recorded'));
  calls.sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0));
  return (
    <StoryBox
      as="section"
      level={2}
      id="recorded"
      kicker="The forward record"
      title="Every call recorded as it happened"
      deck={
        <p className="text-muted">
          {scorecard.firstRecordedWeek ? (
            <>
              The weekly refresh has recorded {scorecard.recordedWeeks} {scorecard.recordedWeeks === 1 ? 'week' : 'weeks'} of
              labels, the first for the week of <time dateTime={scorecard.firstRecordedWeek}>{formatLongDate(scorecard.firstRecordedWeek)}</time>.
              A call is listed here only if its label was written to the ledger soon after the week ended, before the outcome
              weeks existed.
            </>
          ) : (
            'Nothing has been recorded yet. A call is listed here only if its label was written to the ledger soon after the week ended, before the outcome weeks existed.'
          )}
        </p>
      }
    >
      {calls.length === 0 ? (
        <p className="text-muted">No call has been recorded yet. This is expected early on: a call needs a chokepoint to move into one of the two labels.</p>
      ) : (
        <CallRows calls={calls} showRecorded />
      )}

      {scorecard.revisions.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-meta text-fg">Recorded, then scored differently</h3>
          <p className="mt-1 text-meta text-muted">
            The upstream data for these weeks changed after they were recorded. They are listed here and not counted.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[0.9375rem]">
            {scorecard.revisions.map((revision) => (
              <li key={`${revision.chokepointId}-${revision.weekStart}`}>
                {revision.chokepointLabel}, week of {formatLongDate(revision.weekStart)}: recorded “{MANCALE_REGIME_LABELS[revision.recorded]}” on{' '}
                {formatLongDate(revision.recordedOn)}; the data now gives “{MANCALE_REGIME_LABELS[revision.now]}”.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </StoryBox>
  );
}

function History({ scorecard }: { scorecard: Scorecard }) {
  const calls = scorecard.tests.flatMap((test) => test.calls.filter((call) => call.origin === 'history'));
  calls.sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0));
  return (
    <StoryBox
      as="section"
      level={2}
      id="history"
      kicker="Found afterwards"
      title="The same test on the history"
      deck={
        <p className="text-muted">
          Scoring the data since 2019 gives a larger sample at once, but it proves less. The index&rsquo;s thresholds were
          chosen while looking at this same history, so a good result here is what a method fitted to the past would show.
          Only the forward record above is a test.
        </p>
      }
    >
      {calls.length === 0 ? (
        <p className="text-muted">No call in the history.</p>
      ) : (
        <details>
          <summary className="cursor-pointer text-link underline decoration-1 underline-offset-[0.2em]">
            List all {calls.length} calls found in the history
          </summary>
          <div className="mt-4">
            <CallRows calls={calls} showRecorded={false} />
          </div>
        </details>
      )}
    </StoryBox>
  );
}

function Method({ dataThrough }: { dataThrough: string }) {
  const m = SCORECARD_METHOD;
  const base = MANCALE_METHOD;
  return (
    <StoryBox
      as="section"
      level={2}
      id="method"
      kicker={`Scorecard method v${m.version}`}
      title="How it is counted"
      footer={
        <span>
          Sources: IMF PortWatch and the GDELT Project, through the Mancalë Index (<TextLink href="/mancale#method">its method</TextLink>). Counts
          and rates calculated by Novus Data from data through <time dateTime={dataThrough}>{formatLongDate(dataThrough)}</time>.
        </span>
      }
    >
      <dl className="flex flex-col gap-4">
        <div>
          <dt className="text-meta text-fg">What counts as one call</dt>
          <dd className="mt-1">
            The first week of a run of the same label at one chokepoint. A chokepoint that stays in one label for twenty weeks
            made one call, not twenty, because counting every week would make a single episode look like a sample.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">What followed</dt>
          <dd className="mt-1">
            The score that is behind has to rise by at least {m.moveBy} point, on the 0 to {base.cap} scale, above its level in
            the call week, in any of the next {m.horizonWeeks} weeks. A rise settles the call at once. A call with no rise is
            settled only when all {m.horizonWeeks} weeks are in the data, and until then it is listed as waiting and not counted.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Any ordinary week</dt>
          <dd className="mt-1">
            The comparison. The same outcome is measured from every week, at every chokepoint with news data, in which the
            score that has to move started below {m.baselineStartsBelow}. A score that sits near zero rises easily by chance,
            so this is what a label has to beat. These weeks overlap, so the range around that rate is narrower than the
            evidence behind it.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Recorded and found afterwards</dt>
          <dd className="mt-1">
            Each weekly refresh writes the labels of the latest week to a ledger, one line, never edited afterwards. A call is
            <em> recorded</em> if its label is in a ledger line written within {m.timelyWithinDays} days of the week ending. Every
            other call is <em>found afterwards</em>. If upstream data later changes how a recorded week scores, the call is listed
            as revised and left out of the counts.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">When a rate is shown</dt>
          <dd className="mt-1">
            Only once {m.minCallsToRead} calls are settled, with a 95% Wilson interval, which stays honest at small counts.
            Below that the page shows the counts and no rate.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">Fixed in advance</dt>
          <dd className="mt-1">
            The {m.horizonWeeks}-week window, the {m.moveBy}-point move and the ordinary-week rule were set on 25 October 2026,
            before any result was calculated, and are not adjusted to a result. A change would be a new method version, and
            the earlier counts would stay under the old one.
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg">What it cannot show</dt>
          <dd className="mt-1">
            The samples are small, and several chokepoints move together (Suez and the Red Sea share most of their traffic), so
            the calls are fewer independent observations than they look. The index is not seasonally adjusted. A chokepoint
            without news data cannot make a call. Passing a test would not make the index a forecast, and failing one would
            say that the labels describe the week and do not predict the next.
          </dd>
        </div>
      </dl>
    </StoryBox>
  );
}
