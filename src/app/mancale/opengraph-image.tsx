import { ImageResponse } from 'next/og';

import { mancaleEnabled } from '@/config/launch';
import { publication } from '@/config/publication';
import { formatLongDate } from '@/lib/format';
import { MANCALE_REGIME_LABELS, getMancale } from '@/lib/indicators';
import { cardFonts, ogColors, ogSize } from '@/lib/og';

export const alt = `The Mancalë Index from ${publication.name}`;
export const size = ogSize;
export const contentType = 'image/png';

/**
 * The share card for /mancale: the week's reading for each chokepoint, drawn
 * from the same build-time index the page prints. It states only what the page
 * states (a label and a weekly average of ship transits), and it carries the
 * date the ship data runs to, so a card shared later cannot pass for current.
 * With no data file it falls back to the title alone rather than a placeholder.
 */
export default async function MancaleOpengraphImage() {
  const index = mancaleEnabled ? await getMancale() : null;
  const rows = index?.chokepoints ?? [];
  const through = index ? formatLongDate(index.dataThrough) : null;

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
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 600,
              color: ogColors.muted,
              letterSpacing: '-0.01em',
            }}
          >
            {publication.name}
          </div>
          <div style={{ width: 72, height: 3, backgroundColor: ogColors.accent, marginTop: 22 }} />
          <div
            style={{
              display: 'flex',
              fontSize: 58,
              fontWeight: 700,
              color: ogColors.text,
              letterSpacing: '-0.03em',
              marginTop: 18,
            }}
          >
            Mancalë Index
          </div>
        </div>

        {rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((point) => (
              <div
                key={point.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: `1px solid ${ogColors.muted}`,
                  padding: '5px 0',
                  fontSize: 24,
                  color: ogColors.text,
                }}
              >
                <div style={{ display: 'flex', fontWeight: 600 }}>{point.label}</div>
                <div style={{ display: 'flex', gap: 36, fontFamily: 'IBM Plex Mono', color: ogColors.muted }}>
                  <div style={{ display: 'flex' }}>{MANCALE_REGIME_LABELS[point.latest.regime]}</div>
                  <div style={{ display: 'flex' }}>{point.latest.transitsPerDay.toFixed(1)} ships a day</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 34, color: ogColors.muted, maxWidth: 900 }}>
            Is the news about a shipping chokepoint louder or quieter than its ship traffic justifies?
          </div>
        )}

        <div style={{ display: 'flex', fontSize: 22, color: ogColors.muted, fontFamily: 'IBM Plex Mono' }}>
          {through ? `Ship data through ${through}. IMF PortWatch and GDELT.` : 'IMF PortWatch and GDELT.'}
        </div>
      </div>
    ),
    { ...size, fonts: cardFonts() },
  );
}
