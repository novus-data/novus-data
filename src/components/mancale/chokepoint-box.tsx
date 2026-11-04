import { GapChart, NewsChart, ShipsChart, formatMultiple, formatPerDay, signed } from '@/components/mancale/mancale-charts';
import { SourceList } from '@/components/source-list';
import { StoryBox } from '@/components/story-box';
import { TextLink } from '@/components/text-link';
import { formatLongDate } from '@/lib/format';
import { MANCALE_METHOD } from '@/lib/indicators/mancale-method';
import { MANCALE_REGIME_LABELS, type MancaleChokepoint, type MancaleWeek } from '@/lib/indicators/types';

/** The label a week carries, in words. */
export function reading(week: MancaleWeek): string {
  return MANCALE_REGIME_LABELS[week.regime];
}

/**
 * One chokepoint's latest reading and its charts.
 *
 * Shared by `/mancale`, where each of the seven sits in a list and anchors from
 * the scoreboard and the map, and `/mancale/[id]`, where one stands alone. It
 * is one component so the two can never describe the same week differently
 * (§14a). On the standalone page the page's own h1 already names the
 * chokepoint, so the box is titled by the week instead of repeating it.
 *
 * It takes the scored chokepoint as a prop and states nothing the build did
 * not compute from the cited weekly data (Rule 1, §14.1).
 */
export function ChokepointBox({
  point,
  standalone = false,
}: {
  point: MancaleChokepoint;
  /** True on the chokepoint's own page: titled by the week, no anchor, no link to itself. */
  standalone?: boolean;
}) {
  const m = MANCALE_METHOD;
  const week = point.latest;
  const news =
    week.newsXBaseline === null
      ? 'News volume has not been collected for this chokepoint yet.'
      : `news coverage ${formatMultiple(week.newsXBaseline)} its normal. Gap ${signed(week.gap ?? 0, 2)}.`;

  return (
    <StoryBox
      as="section"
      level={standalone ? 2 : 3}
      id={standalone ? undefined : point.id}
      kicker={reading(week)}
      title={standalone ? `Week of ${formatLongDate(week.weekStart)}` : point.label}
      deck={
        <p className="text-muted">
          {standalone ? 'Ship traffic' : `Week of ${formatLongDate(week.weekStart)}`}: {formatPerDay(week.transitsPerDay)} ships a day,{' '}
          {signed(week.flowVsBaselinePct)}% against a normal of {formatPerDay(point.baselineTransitsPerDay)}
          {week.newsXBaseline === null ? '. ' : '; '}
          {news} {point.weeksInRegime > 1 ? `${reading(week)} for ${point.weeksInRegime} weeks.` : ''}
        </p>
      }
      footer={
        <>
          {standalone ? null : <TextLink href={`/mancale/${point.id}`}>This chokepoint on its own page</TextLink>}
          <SourceList compact sources={point.sources} />
        </>
      }
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
