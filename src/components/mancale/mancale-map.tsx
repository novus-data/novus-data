import clsx from 'clsx';

import { HEIGHT, MapBase, WIDTH, project } from '@/components/chokepoint-map-base';
// Labels come from ./types, not the indicators index, which reads files.
import { MANCALE_REGIME_LABELS, type MancaleRegime } from '@/lib/indicators/types';
import { CHOKEPOINTS } from '@/lib/live/nodes';

/**
 * The Mancalë index names the east end of the Strait of Malacca "malacca";
 * the map's node for it is "singapore-strait". Every other id is the same in
 * both. An id missing here, or a node missing from nodes.ts, throws at build
 * rather than dropping a marker without a word.
 */
const NODE_FOR: Record<string, string> = {
  hormuz: 'hormuz',
  'bab-el-mandeb': 'bab-el-mandeb',
  suez: 'suez',
  panama: 'panama',
  'taiwan-strait': 'taiwan-strait',
  malacca: 'singapore-strait',
  bosphorus: 'bosphorus',
};

/**
 * How a marker looks for each label. Shape carries it, not colour: a solid
 * circle for "ships ahead of news", a solid square for "news ahead of ships",
 * an open ring for everything else (aligned, quiet, ships normal). These are
 * the two sharp labels the scorecard tests. Every marker carries its number,
 * and the list under the map says each label in words. Complete class names,
 * so Tailwind finds them.
 */
type Shape = 'circle-solid' | 'square-solid' | 'ring';

const SHAPE: Record<MancaleRegime, Shape> = {
  'reality-led': 'circle-solid',
  'flow-only-elevated': 'circle-solid',
  'flow-only-severe': 'circle-solid',
  'narrative-led': 'square-solid',
  aligned: 'ring',
  quiet: 'ring',
  'flow-only-normal': 'ring',
  'flow-only-surge': 'ring',
};

const MARKER_RADIUS = 22;

export interface MancaleMapPoint {
  id: string;
  label: string;
  regime: MancaleRegime;
}

/**
 * A locator map of the chokepoints the Mancalë Index scores, each numbered and
 * marked by its latest label. Static SVG, no script. Every marker links to that
 * chokepoint's box on the page; the numbered list under the map does the same
 * and states the label in words.
 *
 * Nothing here is a figure. The label on each marker is the one the page already
 * computes at build time from content/indicators/mancale.json.
 */
export function MancaleMap({ points }: { points: MancaleMapPoint[] }) {
  const markers = points.map((point, index) => {
    const nodeId = NODE_FOR[point.id];
    if (!nodeId) throw new Error(`MancaleMap: no map node is named for Mancalë chokepoint "${point.id}".`);
    const node = CHOKEPOINTS.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`MancaleMap: nodes.ts has no chokepoint "${nodeId}" (for "${point.id}").`);
    const [x, y] = project([node.lon, node.lat]);
    return { ...point, number: index + 1, x, y, word: MANCALE_REGIME_LABELS[point.regime] };
  });

  const description =
    `Map of the ${markers.length} chokepoints the Mancalë Index scores, latest label each: ` +
    markers.map((m) => `${m.number}, ${m.label}: ${m.word}`).join('; ') +
    '.';

  return (
    <figure className="flex flex-col gap-4">
      <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={description}>
        <MapBase />
        {markers.map((marker) => (
          <g key={marker.id}>
            {SHAPE[marker.regime] === 'square-solid' ? (
              <rect
                x={marker.x - MARKER_RADIUS}
                y={marker.y - MARKER_RADIUS}
                width={MARKER_RADIUS * 2}
                height={MARKER_RADIUS * 2}
                rx={5}
                className="fill-fg stroke-surface"
                strokeWidth={3}
              />
            ) : (
              <circle
                cx={marker.x}
                cy={marker.y}
                r={MARKER_RADIUS}
                className={SHAPE[marker.regime] === 'circle-solid' ? 'fill-fg stroke-surface' : 'fill-surface stroke-fg'}
                strokeWidth={SHAPE[marker.regime] === 'circle-solid' ? 3 : 2.5}
              />
            )}
            <text
              x={marker.x}
              y={marker.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={clsx('font-sans text-[28px] font-semibold', SHAPE[marker.regime] === 'ring' ? 'fill-fg' : 'fill-surface')}
            >
              {marker.number}
            </text>
          </g>
        ))}
      </svg>

      {/* Real links laid over the markers, as a share of the frame, because an
          <svg role="img"> hides what is inside it from assistive technology
          while keyboard focus can still land there. Hidden below `sm`, where
          neighbouring markers sit closer than a fingertip; the numbered list
          under the map is the target there. */}
      {markers.map((marker) => (
        <a
          key={marker.id}
          href={`#${marker.id}`}
          aria-label={`${marker.label}: ${marker.word}. Jump to its chart.`}
          className="absolute hidden size-6 -translate-x-1/2 -translate-y-1/2 rounded-full ring-link transition-shadow hover:ring-2 focus-visible:outline-none focus-visible:ring-2 sm:block md:size-7"
          style={{ left: `${(marker.x / WIDTH) * 100}%`, top: `${(marker.y / HEIGHT) * 100}%` }}
        />
      ))}
      </div>

      <figcaption className="flex flex-col gap-3">
        <ol className="flex flex-col">
          {markers.map((marker) => (
            <li key={marker.id} className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-b-0">
              <span data-numeric className="w-4 shrink-0 text-meta text-muted">{marker.number}</span>
              <a
                href={`#${marker.id}`}
                className="text-[0.9375rem] text-fg underline decoration-hairline underline-offset-4 transition-colors hover:text-link"
              >
                {marker.label}
              </a>
              <span className="ml-auto text-right text-meta text-muted">{marker.word}</span>
            </li>
          ))}
        </ol>
        <p className="text-meta text-muted">
          Solid circle: ships ahead of news, or disrupted. Solid square: news ahead of ships. Open ring: anything else, such as aligned or quiet.
        </p>
      </figcaption>
    </figure>
  );
}
