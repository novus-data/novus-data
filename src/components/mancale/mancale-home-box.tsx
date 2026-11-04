import { StoryBox } from '@/components/story-box';
import { TextLink } from '@/components/text-link';
import { formatShortDate } from '@/lib/format';
import { MANCALE_REGIME_LABELS, type MancaleIndex } from '@/lib/indicators/types';

/**
 * The home page's Mancalë box: each chokepoint's latest label, and nothing else.
 *
 * **Words and dates only, never a number.** Rule 1 allows the index's figures on
 * `/mancale` and its own pages (§14.1) and nowhere else, so the front page
 * names the reading and links to the page that shows the evidence. A label such
 * as "Ships ahead of news" is a classification a reader can follow to the chart;
 * a figure on the front page would travel without its method beside it.
 *
 * It states its as-of date, and says plainly when the data had not been
 * refreshed at build, in the §6a phrasing (an absolute date, never "N days
 * ago", because the page is static). Everything is derived from the index, so
 * the box needs no edit when a chokepoint is added or the week rolls over
 * (Rule 6).
 */
export function MancaleHomeBox({ index, className }: { index: MancaleIndex; className?: string }) {
  const through = formatShortDate(index.dataThrough);

  return (
    <StoryBox
      className={className}
      kicker="Index"
      title="Mancalë: is the news ahead of the ships?"
      titleHref="/mancale"
      footer={
        <>
          <TextLink href="/mancale">Open the Mancalë Index</TextLink>
          <span>
            {index.staleAtBuild ? 'Not refreshed: ship data runs to ' : 'Ship data through '}
            <time dateTime={index.dataThrough}>{through}</time>
          </span>
        </>
      }
    >
      <p>Each chokepoint&rsquo;s latest weekly reading, set against a fixed 2019&ndash;22 normal.</p>
      <ul className="mt-3 max-w-none sm:columns-2">
        {index.chokepoints.map((point) => (
          <li
            key={point.id}
            className="flex break-inside-avoid items-baseline justify-between gap-3 border-t border-hairline py-2"
          >
            <TextLink href={`/mancale/${point.id}`}>{point.label}</TextLink>
            <span className="text-meta text-muted">{MANCALE_REGIME_LABELS[point.latest.regime]}</span>
          </li>
        ))}
      </ul>
    </StoryBox>
  );
}
