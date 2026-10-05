import clsx from 'clsx';
import Link from 'next/link';

import { StatusBadge } from '@/components/status-badge';
import { LAND, LANES, WATER } from '@/components/world-outline';
// Imported from the types module, not the layer index: ./types is pure data,
// while the index pulls in the filesystem-backed source.
import type { DisruptionStatus, DisruptionSummary } from '@/lib/disruptions/types';
import { STATUS_LABELS } from '@/lib/disruptions/types';
import { CHOKEPOINTS } from '@/lib/live/nodes';

/*
 * The visible window: the Americas' east coast to Japan, the Arctic coast to
 * the Cape. Equirectangular, because a locator map only has to say "here",
 * and a plain lon/lat grid keeps the chokepoint coordinates readable in code.
 */
const WEST = -130;
const EAST = 150;
const NORTH = 72;
const SOUTH = -46;
const WIDTH = 1000;
const SCALE = WIDTH / (EAST - WEST);
const HEIGHT = Math.round((NORTH - SOUTH) * SCALE);

function project([lon, lat]: readonly [number, number]): [number, number] {
  return [(lon - WEST) * SCALE, (NORTH - lat) * SCALE];
}

function points(outline: ReadonlyArray<readonly [number, number]>): string {
  return outline
    .map((point) =>
      project(point)
        .map((value) => value.toFixed(1))
        .join(','),
    )
    .join(' ');
}

/**
 * Short names for the map labels, and where each label sits so the cluster
 * from Gibraltar to Hormuz does not overprint itself. The full names come from
 * nodes.ts and are used everywhere else.
 */
const LABELS: Record<
  string,
  { text: string; dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }
> = {
  suez: { text: 'Suez', dx: -14, dy: 4, anchor: 'end' },
  'bab-el-mandeb': { text: 'Bab el-Mandeb', dx: 14, dy: 12, anchor: 'start' },
  hormuz: { text: 'Hormuz', dx: 14, dy: -4, anchor: 'start' },
  'singapore-strait': { text: 'Malacca', dx: 14, dy: 14, anchor: 'start' },
  'taiwan-strait': { text: 'Taiwan Strait', dx: 0, dy: -18, anchor: 'middle' },
  panama: { text: 'Panama', dx: -14, dy: 4, anchor: 'end' },
  bosphorus: { text: 'Bosphorus', dx: 14, dy: -6, anchor: 'start' },
  gibraltar: { text: 'Gibraltar', dx: -14, dy: 12, anchor: 'end' },
  dover: { text: 'Dover', dx: -16, dy: -4, anchor: 'end' },
  'cape-of-good-hope': {
    text: 'Cape of Good Hope',
    dx: 0,
    dy: 27,
    anchor: 'middle',
  },
};

// Complete class names, so Tailwind finds them when it scans this file.
const FILL: Record<DisruptionStatus, string> = {
  active: 'fill-status-active',
  easing: 'fill-status-easing',
  watch: 'fill-status-watch',
  resolved: 'fill-status-resolved',
};

interface Point {
  id: string;
  name: string;
  label: (typeof LABELS)[string];
  x: number;
  y: number;
  /** The most pressing open entry naming this place, if any. */
  entry: DisruptionSummary | null;
}

/**
 * A locator map of the chokepoints the site tracks, with each one filled in
 * when an open register entry names it in `places`.
 *
 * Nothing on the map is a measurement. The markers are positions, and their
 * only state is whether the register has an open entry there, which is a
 * fact a human wrote and dated. A status colour never appears without its
 * word: the map label carries it, and the list under the map repeats it with
 * a link to the entry. Static SVG; no script.
 */
export function ChokepointMap({ disruptions }: { disruptions: DisruptionSummary[] }) {
  // `disruptions` arrives in register order (active first, then most recently
  // reviewed), so the first open entry naming a place is the one to show.
  const open = disruptions.filter((entry) => entry.status !== 'resolved');

  const markers: Point[] = CHOKEPOINTS.map((node) => {
    const [x, y] = project([node.lon, node.lat]);
    return {
      id: node.id,
      name: node.name,
      label: LABELS[node.id] ?? {
        text: node.name,
        dx: 10,
        dy: 4,
        anchor: 'start',
      },
      x,
      y,
      entry: open.find((entry) => entry.places.includes(node.id)) ?? null,
    };
  });

  const withEntries = markers.filter((marker) => marker.entry);
  const description =
    `Map of the ${markers.length} chokepoints tracked: ${markers.map((m) => m.name).join(', ')}. ` +
    (withEntries.length === 0
      ? 'None has an open register entry.'
      : `Open register entries at ${withEntries
          .map((m) => `${m.name}: ${STATUS_LABELS[m.entry!.status]}`)
          .join('; ')}.`);

  return (
    <figure className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={description}
      >
        <rect width={WIDTH} height={HEIGHT} className="fill-ink" />

        {LAND.map((outline, index) => (
          <polygon
            key={`land-${index}`}
            points={points(outline)}
            className="fill-surface-2 stroke-rule"
            strokeWidth={0.75}
            strokeLinejoin="round"
          />
        ))}
        {WATER.map((outline, index) => (
          <polygon
            key={`water-${index}`}
            points={points(outline)}
            className="fill-ink stroke-rule"
            strokeWidth={0.75}
            strokeLinejoin="round"
          />
        ))}

        {LANES.map((lane, index) => (
          <polyline
            key={`lane-${index}`}
            points={points(lane)}
            fill="none"
            className="stroke-accent"
            strokeOpacity={0.45}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {markers.map((marker) => (
          <g key={marker.id}>
            {/* At phone width the whole map is ~300px across, so a marker
                drawn for the desktop would be a pixel or two. Scaled about
                its own centre so it stays on its coordinate. */}
            <g className="origin-center scale-[2.5] [transform-box:fill-box] sm:scale-100">
              {marker.entry ? (
                <>
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={11}
                    className={FILL[marker.entry.status]}
                    fillOpacity={0.2}
                  />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={6}
                    className={clsx(FILL[marker.entry.status], 'stroke-surface')}
                    strokeWidth={2}
                  />
                </>
              ) : (
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={5}
                  className="fill-surface stroke-muted"
                  strokeWidth={1.5}
                />
              )}
            </g>
            {/* Labels are too small to read on a phone; the line under the
                map carries the names there. */}
            <text
              x={marker.x + marker.label.dx}
              y={marker.y + marker.label.dy}
              textAnchor={marker.label.anchor}
              className={clsx(
                'hidden font-sans text-[13px] sm:block',
                marker.entry ? 'fill-fg font-semibold' : 'fill-muted',
              )}
              style={{ paintOrder: 'stroke' }}
              stroke="var(--ink)"
              strokeWidth={4}
              strokeLinejoin="round"
            >
              {marker.label.text}
              {marker.entry ? ` · ${STATUS_LABELS[marker.entry.status]}` : ''}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="flex flex-col gap-3">
        {/* The SVG's label already reads the names to assistive technology. */}
        <p className="text-meta text-muted sm:hidden" aria-hidden="true">
          {markers.map((marker) => marker.label.text).join(' · ')}
        </p>

        {withEntries.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {withEntries.map((marker) => (
              <li key={marker.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <StatusBadge status={marker.entry!.status} />
                <span className="text-meta text-muted">{marker.name}</span>
                <Link
                  href={`/disruptions/${marker.entry!.id}`}
                  className="text-[0.9375rem] text-fg underline decoration-hairline underline-offset-4 transition-colors hover:text-link"
                >
                  {marker.entry!.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>
    </figure>
  );
}
