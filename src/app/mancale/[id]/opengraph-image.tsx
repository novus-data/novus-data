import { ImageResponse } from 'next/og';

import { mancaleEnabled } from '@/config/launch';
import { publication } from '@/config/publication';
import { formatLongDate } from '@/lib/format';
import { getMancale } from '@/lib/indicators';
import { MANCALE_REGIME_LABELS, type MancaleWeek } from '@/lib/indicators/types';
import { cardFonts, ogColors, ogSize } from '@/lib/og';

export const alt = `One chokepoint of the Mancalë Index from ${publication.name}`;
export const size = ogSize;
export const contentType = 'image/png';

export async function generateStaticParams() {
  if (!mancaleEnabled) return [];
  const index = await getMancale();
  return (index?.chokepoints ?? []).map((point) => ({ id: point.id }));
}

/** Weeks drawn: a year, so the card shows the recent shape without becoming a history. */
const WEEKS_SHOWN = 52;
const CHART = { width: 1040, height: 190, cap: 6 } as const;

/** An SVG path for a series, starting a new stroke after any week with no value. */
function path(weeks: MancaleWeek[], pick: (week: MancaleWeek) => number | null): string {
  const step = CHART.width / Math.max(weeks.length - 1, 1);
  let d = '';
  let pen = false;
  weeks.forEach((week, i) => {
    const value = pick(week);
    if (value === null) {
      pen = false;
      return;
    }
    const x = (i * step).toFixed(1);
    const y = (CHART.height - (Math.min(value, CHART.cap) / CHART.cap) * CHART.height).toFixed(1);
    d += `${pen ? 'L' : 'M'}${x} ${y} `;
    pen = true;
  });
  return d.trim();
}

/**
 * The share card for one chokepoint: its latest label, its flow-stress and
 * attention scores for the past year, and the date the ship data runs to.
 *
 * Everything is drawn from the same build-time index the page prints, so the
 * card cannot say what the page does not. Two lines are told apart by solid
 * versus dashed and by a direct label, never by colour alone. The card carries
 * the as-of date, so a card shared later cannot pass for current. A chokepoint
 * with no news volume yet draws the ship line only and says why. With no data
 * file it falls back to the publication's name rather than a placeholder.
 */
export default async function MancaleChokepointOpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = mancaleEnabled ? await getMancale() : null;
  const point = index?.chokepoints.find((candidate) => candidate.id === id) ?? null;

  const weeks = point ? point.weeks.slice(-WEEKS_SHOWN) : [];
  const latest = point?.latest ?? null;
  const through = index ? formatLongDate(index.dataThrough) : null;
  const title = point?.label ?? publication.name;
  const titleSize = title.length > 28 ? 60 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: ogColors.ink,
          padding: '44px 80px',
          fontFamily: 'IBM Plex Sans',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: ogColors.muted, letterSpacing: '-0.01em' }}>
            {publication.name} · Mancalë Index
          </div>
          <div style={{ width: 72, height: 3, backgroundColor: ogColors.accent, marginTop: 20 }} />
          <div
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 700,
              color: ogColors.text,
              letterSpacing: '-0.03em',
              marginTop: 14,
            }}
          >
            {title}
          </div>
          {latest ? (
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: ogColors.accent, marginTop: 6 }}>
              {MANCALE_REGIME_LABELS[latest.regime]}
            </div>
          ) : null}
        </div>

        {point && latest && weeks.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 36, fontSize: 22, fontWeight: 600, color: ogColors.text, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="40" height="6" viewBox="0 0 40 6">
                  <line x1="0" y1="3" x2="40" y2="3" stroke={ogColors.accent} strokeWidth="4" />
                </svg>
                Flow stress (ships)
              </div>
              {point.hasNews ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="40" height="6" viewBox="0 0 40 6">
                    <line x1="0" y1="3" x2="40" y2="3" stroke={ogColors.text} strokeWidth="4" strokeDasharray="8 5" />
                  </svg>
                  Attention (news)
                </div>
              ) : (
                <div style={{ display: 'flex', color: ogColors.muted }}>News volume not collected yet</div>
              )}
            </div>
            <svg width={CHART.width} height={CHART.height} viewBox={`0 0 ${CHART.width} ${CHART.height}`}>
              <line x1="0" y1={CHART.height} x2={CHART.width} y2={CHART.height} stroke={ogColors.muted} strokeWidth="1" />
              <line x1="0" y1={CHART.height / 3} x2={CHART.width} y2={CHART.height / 3} stroke="#c5c9d3" strokeWidth="1" />
              <line x1="0" y1={(CHART.height * 2) / 3} x2={CHART.width} y2={(CHART.height * 2) / 3} stroke="#c5c9d3" strokeWidth="1" />
              <path d={path(weeks, (week) => week.flowStress)} fill="none" stroke={ogColors.accent} strokeWidth="4" strokeLinejoin="round" />
              {point.hasNews ? (
                <path
                  d={path(weeks, (week) => week.attention)}
                  fill="none"
                  stroke={ogColors.text}
                  strokeWidth="3"
                  strokeDasharray="9 6"
                  strokeLinejoin="round"
                />
              ) : null}
            </svg>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 34, color: ogColors.muted, maxWidth: 900 }}>
            Is the news about a shipping chokepoint louder or quieter than its ship traffic justifies?
          </div>
        )}

        <div style={{ display: 'flex', fontSize: 21, color: ogColors.muted, fontFamily: 'IBM Plex Mono' }}>
          {through
            ? `Scores 0 to 6 against a fixed 2019–22 normal. Ship data through ${through}. ${point?.hasNews ? 'IMF PortWatch and GDELT.' : 'IMF PortWatch.'}`
            : 'IMF PortWatch and GDELT.'}
        </div>
      </div>
    ),
    { ...size, fonts: cardFonts() },
  );
}
