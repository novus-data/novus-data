import clsx from 'clsx';
import Link from 'next/link';

import { StatusBadge } from '@/components/status-badge';
import { StoryBox } from '@/components/story-box';
import { HEIGHT, MapBase, WIDTH, project } from '@/components/chokepoint-map-base';
// Both layers' labels come from their types modules, not the layer indexes:
// ./types is pure data, while each index pulls in a filesystem-backed source.
import type { IssueSummary } from '@/lib/content/types';
import { POST_KIND_LABELS, postPath } from '@/lib/content/types';
import type { DisruptionStatus, DisruptionSummary } from '@/lib/disruptions/types';
import { STATUS_LABELS } from '@/lib/disruptions/types';
import { formatShortDate, toDate } from '@/lib/format';
import { CHOKEPOINTS } from '@/lib/live/nodes';
import { placesForTags } from '@/lib/places';

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
  'taiwan-strait': { text: 'Taiwan Strait', dx: 0, dy: -20, anchor: 'middle' },
  // Right of the marker: Panama sits near the frame's west edge.
  panama: { text: 'Panama', dx: 14, dy: 4, anchor: 'start' },
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

/** How many posts a place's card lists before it says how many there are in all. */
const POSTS_PER_PLACE = 3;

const LINK =
  'text-[0.9375rem] text-fg underline decoration-hairline underline-offset-4 transition-colors hover:text-link';

interface Point {
  id: string;
  name: string;
  label: (typeof LABELS)[string];
  x: number;
  y: number;
  /** Every open entry naming this place, most pressing first. */
  entries: DisruptionSummary[];
  /** The most pressing of them, which decides the marker's fill. */
  entry: DisruptionSummary | null;
  /** Posts tagged with this place, newest first. */
  posts: IssueSummary[];
}

function popoverId(id: string): string {
  return `chokepoint-${id}`;
}

/** Newest first. A post whose date does not parse sorts last; no date is guessed for it. */
function byNewest(a: IssueSummary, b: IssueSummary): number {
  const at = toDate(a.publishedAt)?.getTime() ?? -Infinity;
  const bt = toDate(b.publishedAt)?.getTime() ?? -Infinity;
  return at === bt ? 0 : bt > at ? 1 : -1;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What a place's button says to assistive technology before it is opened. */
function describe(marker: Point): string {
  const parts = [
    marker.entries.length > 0
      ? count(marker.entries.length, 'open register entry', 'open register entries')
      : null,
    marker.posts.length > 0 ? count(marker.posts.length, 'post', 'posts') : null,
  ].filter(Boolean);
  return `${marker.name}: ${parts.join(', ')}`;
}

/**
 * A locator map of the chokepoints the site tracks, with each one filled in
 * when an open register entry names it in `places`.
 *
 * Nothing on the map is a measurement. The markers are positions, and their
 * only state is whether the register has an open entry there, which is a
 * fact a human wrote and dated. A status colour never appears without its
 * word: the map label carries it, and the list under the map repeats it with
 * a link to the entry.
 *
 * A place with an open entry or a post tagged with it (src/lib/places.ts)
 * opens a card listing both. The cards use the browser's Popover API, so the
 * map still ships no script: a button names its card with `popovertarget`,
 * and the browser opens, closes and light-dismisses it. A browser without the
 * API ignores the attribute, so the cards render in the page under the map.
 */
export function ChokepointMap({
  disruptions,
  posts = [],
}: {
  disruptions: DisruptionSummary[];
  /** Every post a reader may open. Leave out any kind that is switched off. */
  posts?: IssueSummary[];
}) {
  // `disruptions` arrives in register order (active first, then most recently
  // reviewed), so the first open entry naming a place is the one to show.
  const open = disruptions.filter((entry) => entry.status !== 'resolved');
  const tagged = posts
    .map((post) => ({ post, places: placesForTags(post.tags) }))
    .filter(({ places }) => places.length > 0);

  const markers: Point[] = CHOKEPOINTS.map((node) => {
    const [x, y] = project([node.lon, node.lat]);
    const entries = open.filter((entry) => entry.places.includes(node.id));
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
      entries,
      entry: entries[0] ?? null,
      posts: tagged
        .filter(({ places }) => places.includes(node.id))
        .map(({ post }) => post)
        .sort(byNewest),
    };
  });

  const withEntries = markers.filter((marker) => marker.entry);
  const withCards = markers.filter(
    (marker) => marker.entries.length > 0 || marker.posts.length > 0,
  );
  const description =
    `Map of the ${markers.length} chokepoints tracked: ${markers.map((m) => m.name).join(', ')}. ` +
    (withEntries.length === 0
      ? 'None has an open register entry.'
      : `Open register entries at ${withEntries
          .map((m) => `${m.name}: ${STATUS_LABELS[m.entry!.status]}`)
          .join('; ')}.`);

  return (
    <figure className="flex flex-col gap-4">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={description}
        >
          <MapBase />

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

        {/* Hit targets laid over the markers, positioned as a share of the
            frame so they track the SVG at any width. Hidden below `sm`, where
            neighbouring markers sit closer than a fingertip; the names under
            the map are the targets there. */}
        {withCards.map((marker) => (
          <button
            key={marker.id}
            type="button"
            popoverTarget={popoverId(marker.id)}
            aria-label={describe(marker)}
            className="absolute hidden size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ring-link transition-shadow hover:ring-2 sm:block md:size-7"
            style={{ left: `${(marker.x / WIDTH) * 100}%`, top: `${(marker.y / HEIGHT) * 100}%` }}
          />
        ))}
      </div>

      <figcaption className="flex flex-col gap-3">
        {/* The SVG's label already reads the names to assistive technology. */}
        <p className="text-meta text-muted sm:hidden" aria-hidden="true">
          {markers.map((marker) => marker.label.text).join(' · ')}
        </p>

        {/* The key. The markers say two things and a map with no key is a
            picture: a filled marker is a place an open register entry names
            (its label then gives the status in words); a ring is a place the
            site watches that has none open. Drawn in neutral ink, because the
            status colours never appear without their word. */}
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-meta text-muted" aria-label="Map key">
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-fg" aria-hidden="true" />
            Open register entry
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full border-[1.5px] border-muted bg-surface" aria-hidden="true" />
            Watched, none open
          </li>
          <li className="flex items-center gap-2">
            <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true" focusable="false">
              <line x1="1" y1="3" x2="21" y2="3" className="stroke-accent" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />
            </svg>
            Sea lane, for context
          </li>
        </ul>

        {withCards.length > 0 ? (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta text-muted">
            <span>Select a place to see what is published on it:</span>
            {withCards.map((marker) => (
              <button
                key={marker.id}
                type="button"
                popoverTarget={popoverId(marker.id)}
                className="cursor-pointer text-link underline decoration-hairline underline-offset-4 transition-colors hover:decoration-current"
              >
                {marker.label.text}
              </button>
            ))}
          </p>
        ) : null}

        {withEntries.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {withEntries.map((marker) => (
              <li key={marker.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <StatusBadge status={marker.entry!.status} />
                <span className="text-meta text-muted">{marker.name}</span>
                <Link href={`/disruptions/${marker.entry!.id}`} className={LINK}>
                  {marker.entry!.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

      </figcaption>

      {withCards.map((marker) => (
        <PlaceCard key={marker.id} marker={marker} />
      ))}
    </figure>
  );
}

/**
 * Everything published on one place: its open register entries, then its
 * latest posts. Shown in the top layer when its button is pressed; the
 * browser closes it on Escape, on a click outside, or from its own button.
 */
function PlaceCard({ marker }: { marker: Point }) {
  const id = popoverId(marker.id);
  const shown = marker.posts.slice(0, POSTS_PER_PLACE);

  return (
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-labelledby={`${id}-card-title`}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto border-0 bg-transparent p-0 text-fg backdrop:bg-fg/25"
    >
      <StoryBox
        as="section"
        size="compact"
        id={`${id}-card`}
        kicker="Chokepoint"
        title={marker.name}
        footer={
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            className="cursor-pointer text-link underline decoration-hairline underline-offset-4 transition-colors hover:decoration-current"
          >
            Close
          </button>
        }
      >
        {marker.entries.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-meta text-muted">In the register</p>
            <ul className="flex flex-col gap-2">
              {marker.entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <StatusBadge status={entry.status} />
                  <Link href={`/disruptions/${entry.id}`} className={LINK}>
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {shown.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-meta text-muted">Published</p>
            <ul className="flex flex-col gap-3">
              {shown.map((post) => {
                const date = formatShortDate(post.publishedAt);
                return (
                  <li key={post.slug} className="flex flex-col gap-0.5">
                    <span className="text-meta text-muted">
                      {POST_KIND_LABELS[post.kind]}
                      {date ? ` · ${date}` : ''}
                    </span>
                    <Link href={postPath(post)} className={LINK}>
                      {post.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {marker.posts.length > shown.length ? (
              <p className="text-meta text-muted">
                The latest {shown.length} of {marker.posts.length}.
              </p>
            ) : null}
          </div>
        ) : null}
      </StoryBox>
    </div>
  );
}
