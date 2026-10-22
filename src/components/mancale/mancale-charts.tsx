import type { ReactNode } from 'react';

import type { MancaleWeek } from '@/lib/indicators/types';
import { formatShortDate } from '@/lib/format';

/**
 * The Mancalë Index charts. Server components: hand-written SVG, no chart
 * library and no JavaScript (§7), so the page stays static.
 *
 * FORM
 *
 * One series per chart, so no legend: the heading names it. Three small
 * charts per chokepoint rather than lines sharing an axis, because ships (a
 * percentage of normal), news (a multiple of normal) and the gap (a score)
 * are in different units — one axis would be meaningless and two would be
 * worse.
 *
 * Every mark is --accent, the structural blue, which is its sanctioned use.
 * The gap's sign is carried by position (above or below zero, labelled in
 * words), not by colour, so there is no second hue to learn and nothing
 * leans on colour alone. Amber is never used: it is reserved for the
 * register's "active" status.
 *
 * Each chart carries a visually hidden sentence with its first, latest and
 * extreme values; the scoreboard table on the page is the full table view.
 * The x axis marks each January. No event markers are drawn: an annotation is
 * a claim, and a claim on this site needs a source next to it.
 */

const NUMBER = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** A real minus sign, so negative figures line up and read as numbers. */
export function signed(value: number, digits = 0): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return digits ? (0).toFixed(digits) : '0';
  return `${value < 0 ? '−' : '+'}${text}`;
}

export function formatMultiple(value: number): string {
  if (value >= 10) return `${WHOLE.format(value)}×`;
  return `${NUMBER.format(value)}×`;
}

export function formatPerDay(value: number): string {
  return NUMBER.format(value);
}

function yearTicks(weeks: MancaleWeek[]): { index: number; year: string }[] {
  const ticks: { index: number; year: string }[] = [];
  let last = '';
  weeks.forEach((week, index) => {
    const year = week.weekStart.slice(0, 4);
    // Label the first week that starts in a new year; skip the stray 2018 week.
    if (year !== last && index > 0) ticks.push({ index, year });
    last = year;
  });
  return ticks;
}

function Frame({
  weeks,
  top,
  middle,
  bottom,
  middleAt,
  children,
}: {
  weeks: MancaleWeek[];
  top: string;
  middle?: string;
  bottom: string;
  /** Where the middle label sits, as a percentage from the top. */
  middleAt?: number;
  children: ReactNode;
}) {
  const count = weeks.length;
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] gap-x-2">
        <div className="relative h-20">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
            <line x1="0" x2="100" y1="0" y2="0" stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2="100" y1="100" y2="100" stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            {children}
          </svg>
        </div>
        <div aria-hidden="true" className="relative h-20 w-14 text-[0.6875rem] leading-none text-muted">
          <span data-numeric className="absolute top-0 -translate-y-1/2">{top}</span>
          {middle !== undefined && middleAt !== undefined ? (
            <span data-numeric className="absolute -translate-y-1/2" style={{ top: `${middleAt}%` }}>
              {middle}
            </span>
          ) : null}
          <span data-numeric className="absolute bottom-0 translate-y-1/2">{bottom}</span>
        </div>
      </div>
      <div aria-hidden="true" className="relative mr-16 mt-1.5 h-3 text-[0.6875rem] leading-none text-muted">
        {yearTicks(weeks).map((tick) => (
          <span key={tick.year} data-numeric className="absolute -translate-x-1/2" style={{ left: `${(tick.index / (count - 1)) * 100}%` }}>
            {/* Every year on wide screens, every other year on narrow ones. */}
            <span className={Number(tick.year) % 2 ? 'hidden sm:inline' : undefined}>{tick.year}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function linePath(values: (number | null)[], y: (value: number) => number): string {
  const count = values.length;
  let path = '';
  let pen = false;
  values.forEach((value, index) => {
    if (value === null) {
      pen = false;
      return;
    }
    path += `${pen ? 'L' : 'M'}${((index / (count - 1)) * 100).toFixed(2)} ${y(value).toFixed(2)}`;
    pen = true;
  });
  return path;
}

function weekLabel(iso: string): string {
  return formatShortDate(iso) ?? iso;
}

/** Ship traffic as a percentage of the 2019–22 normal. */
export function ShipsChart({ weeks, label }: { weeks: MancaleWeek[]; label: string }) {
  const pct = weeks.map((week) => 100 + week.flowVsBaselinePct);
  // Scale to the 99th percentile, not the maximum: one bad week in the
  // upstream data would otherwise flatten seven years into a line. Weeks
  // above the top are drawn at the top, and the caption says how many.
  const sorted = [...pct].sort((a, b) => a - b);
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  const high = Math.max(130, Math.ceil((p99 * 1.08) / 10) * 10);
  const offScale = pct.filter((value) => value > high).length;
  const y = (value: number) => (1 - Math.min(high, Math.max(0, value)) / high) * 100;
  const latest = weeks[weeks.length - 1];
  const lowest = weeks.reduce((min, week) => (week.flowVsBaselinePct < min.flowVsBaselinePct ? week : min));

  return (
    <figure>
      <figcaption className="text-meta text-fg">
        Ship transits, % of the 2019&ndash;22 normal
        {offScale > 0 ? (
          <span className="text-muted">
            {' '}
            ({offScale} {offScale === 1 ? 'week' : 'weeks'} above {high}% drawn at the top)
          </span>
        ) : null}
      </figcaption>
      <div className="mt-2">
        <Frame weeks={weeks} top={`${high}%`} middle="100%" middleAt={y(100)} bottom="0%">
          <line x1="0" x2="100" y1={y(100)} y2={y(100)} stroke="var(--text-muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={linePath(pct, y)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </Frame>
      </div>
      <p className="sr-only">
        {label}: ship transits each week from {weekLabel(weeks[0].weekStart)} to {weekLabel(latest.weekStart)}. In the
        latest week, {formatPerDay(latest.transitsPerDay)} a day, {signed(latest.flowVsBaselinePct)}% against normal. Lowest
        week: {weekLabel(lowest.weekStart)}, {signed(lowest.flowVsBaselinePct)}%.
      </p>
    </figure>
  );
}

const LOG_LOW = 0.1;
const LOG_CEILINGS = [10, 100, 1000, 10000];

/** News coverage as a multiple of its 2019–22 normal, on a log scale: 0.5× and 2× sit the same distance from normal. */
export function NewsChart({ weeks, label }: { weeks: MancaleWeek[]; label: string }) {
  const values = weeks.map((week) => (week.newsXBaseline === null ? null : Math.max(LOG_LOW, week.newsXBaseline)));
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return null;
  const peak = Math.max(...known);
  const high = LOG_CEILINGS.find((ceiling) => ceiling >= peak * 1.2) ?? 10000;
  const y = (value: number) => (1 - (Math.log(value) - Math.log(LOG_LOW)) / (Math.log(high) - Math.log(LOG_LOW))) * 100;
  const latest = weeks[weeks.length - 1];
  const loudest = weeks.reduce((max, week) => ((week.newsXBaseline ?? 0) > (max.newsXBaseline ?? 0) ? week : max));

  return (
    <figure>
      <figcaption className="text-meta text-fg">News coverage, multiple of its 2019&ndash;22 normal (log scale)</figcaption>
      <div className="mt-2">
        <Frame weeks={weeks} top={formatMultiple(high)} middle="1×" middleAt={y(1)} bottom={`${LOG_LOW}×`}>
          <line x1="0" x2="100" y1={y(1)} y2={y(1)} stroke="var(--text-muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={linePath(values, y)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </Frame>
      </div>
      <p className="sr-only">
        {label}: news coverage each week as a multiple of normal. Latest week:{' '}
        {latest.newsXBaseline === null ? 'no value' : formatMultiple(latest.newsXBaseline)}. Loudest week:{' '}
        {weekLabel(loudest.weekStart)}, {formatMultiple(loudest.newsXBaseline ?? 0)}.
      </p>
    </figure>
  );
}

/** The weekly gap, as bars above and below zero, with the ±2 cut-offs drawn. */
export function GapChart({
  weeks,
  label,
  narrativeLedAt,
  realityLedAt,
  cap,
}: {
  weeks: MancaleWeek[];
  label: string;
  narrativeLedAt: number;
  realityLedAt: number;
  cap: number;
}) {
  const scored = weeks.filter((week) => week.gap !== null);
  if (scored.length < 2) return null;
  const count = weeks.length;
  const y = (value: number) => (1 - (value + cap) / (2 * cap)) * 100;
  const step = 100 / count;
  const latest = weeks[weeks.length - 1];
  const highest = scored.reduce((max, week) => (week.gap! > max.gap! ? week : max));
  const lowest = scored.reduce((min, week) => (week.gap! < min.gap! ? week : min));

  return (
    <figure>
      <figcaption className="text-meta text-fg">Mancalë gap: attention minus flow stress</figcaption>
      <div className="relative mt-2">
        <Frame weeks={weeks} top={signed(cap)} middle="0" middleAt={50} bottom={signed(-cap)}>
          {/* Every bar in one path rather than ~400 <rect>s: the same marks
              at a fraction of the page weight. */}
          <path
            fill="var(--accent)"
            d={weeks
              .map((week, index) =>
                week.gap === null || week.gap === 0
                  ? ''
                  : `M${(index * step + step * 0.1).toFixed(2)} 50V${y(week.gap).toFixed(2)}h${(step * 0.8).toFixed(2)}V50Z`,
              )
              .join('')}
          />
          <line x1="0" x2="100" y1="50" y2="50" stroke="var(--text-muted)" vectorEffect="non-scaling-stroke" />
          {[narrativeLedAt, realityLedAt].map((level) => (
            <line key={level} x1="0" x2="100" y1={y(level)} y2={y(level)} stroke="var(--border-strong)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          ))}
        </Frame>
      </div>
      {/* The key sits under the chart, not on it, so no label ever covers a bar. */}
      <p aria-hidden="true" className="mt-2 text-[0.6875rem] leading-snug text-muted">
        Above 0: news ahead of ships. Below 0: ships ahead of news. Dashed lines: {signed(narrativeLedAt)} and{' '}
        {signed(realityLedAt)}, where the labels change.
      </p>
      <p className="sr-only">
        {label}: the gap each week. Latest week: {latest.gap === null ? 'no value' : signed(latest.gap, 2)}. Highest:{' '}
        {signed(highest.gap!, 2)} in the week of {weekLabel(highest.weekStart)}. Lowest: {signed(lowest.gap!, 2)} in the
        week of {weekLabel(lowest.weekStart)}.
      </p>
    </figure>
  );
}
