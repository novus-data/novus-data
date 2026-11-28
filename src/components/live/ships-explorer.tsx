'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';

import { SHAPE_FOR, SHAPE_KEY, ShipIcon, ShipMark } from '@/components/live/ship-shapes';
import { formatUtc, formatUtcDateOnly } from '@/lib/live/display';
import { PANEL_HEIGHT, PANEL_WIDTH } from '@/lib/live/panel-geo';
import {
  NO_FILTERS,
  carrierIndicesOf,
  dayToDate,
  filterVessels,
  heardAt,
  hasFilters,
  shipCategoryOf,
  typeSourceOf,
  type ShipDot,
  type ShipFilters,
  type ShipsData,
} from '@/lib/live/vessel-filter';
import { CARRIER_STALE_AFTER_DAYS, RELATIONSHIP_LABELS } from '@/lib/carriers/types';
import { SHIP_CATEGORIES, SHIP_CATEGORY_LABELS, type ShipCategory } from '@/lib/live/vessels';

/**
 * The interactive layer of the ship panels: one client component.
 *
 * Everything around it is rendered on the server and passed in as `cards`
 * (each card's heading, summary, counts table, coastline and register links),
 * so a reader without JavaScript still gets every number. This adds the
 * filters, the ship marks, "X shown of Y heard", the details card and the
 * per-card ship table.
 *
 * Filter and selection state live here, so the page's five-minute
 * router.refresh() (auto-refresh.tsx) keeps them. A selected ship that is not
 * in the new sample is simply not found, and the details card closes.
 *
 * Ship names are crew-typed radio text: rendered as React text only, never as
 * HTML, never into a URL.
 */

export interface ShipCard {
  nodeId: string;
  name: string;
  /** Server-rendered: kicker, title, summary, coverage note, counts-by-type table. */
  header: ReactNode;
  /** Server-rendered: the coastline and the sampling-area outline, as an <svg>. */
  map: ReactNode;
  /** Server-rendered: the open register entries naming this place. */
  footer: ReactNode;
}

/** At most this many rows in a card's ship table; the rest are counted, not listed. */
export const TABLE_ROWS = 100;

const TYPE_SOURCE_WORDS = {
  0: 'not heard',
  1: 'reported by the ship in this sample',
} as const;

function nameOf(ship: ShipDot): string {
  if (ship.w) return 'Name not shown';
  return ship.n ?? 'Name not heard';
}

function typeKnownHow(ship: ShipDot): string {
  const k = typeSourceOf(ship);
  if (k === 2) return ship.r !== undefined ? `from earlier reports, last heard ${formatUtcDateOnly(dayToDate(ship.r))}` : 'from earlier reports';
  return TYPE_SOURCE_WORDS[k];
}

export function ShipsExplorer({ data, cards }: { data: ShipsData; cards: ShipCard[] }) {
  const [filters, setFilters] = useState<ShipFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<{ nodeId: string; mmsi: string } | null>(null);
  const ids = useId();

  const shown = useMemo(() => {
    const out: Record<string, ShipDot[]> = {};
    for (const card of cards) out[card.nodeId] = filterVessels(data.byNode[card.nodeId] ?? [], filters, data.flags, data.carriers);
    return out;
  }, [cards, data, filters]);

  const update = (patch: Partial<ShipFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const filtering = hasFilters(filters);
  const totalShown = Object.values(shown).reduce((sum, list) => sum + list.length, 0);
  const totalHeard = cards.reduce((sum, card) => sum + (data.byNode[card.nodeId]?.length ?? 0), 0);

  return (
    <div>
      <div className="grid gap-x-10 gap-y-5 border-y border-hairline py-4 lg:grid-cols-[1fr_20rem]">
        <fieldset className="min-w-0">
          <legend className="kicker kicker-muted mb-2">Filter ships</legend>

          <div role="group" aria-label="Type" className="flex flex-wrap gap-1.5">
            {(['all', ...SHIP_CATEGORIES] as const).map((category) => {
              const pressed = filters.category === category;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => update({ category: category as ShipCategory | 'all' })}
                  className={
                    'min-h-[2.75rem] rounded-[2px] border px-3 text-meta transition-colors focus-visible:outline-2 focus-visible:outline-link ' +
                    (pressed ? 'border-link bg-link text-surface' : 'border-rule bg-surface text-fg hover:bg-surface-2')
                  }
                >
                  {category === 'all' ? 'All types' : SHIP_CATEGORY_LABELS[category as ShipCategory]}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 text-meta">
            <label htmlFor={`${ids}-underway`} className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 text-fg">
              <input
                id={`${ids}-underway`}
                type="checkbox"
                checked={filters.underwayOnly}
                onChange={(event) => update({ underwayOnly: event.target.checked })}
                className="h-4 w-4 accent-link"
              />
              Under way only
            </label>

            <label htmlFor={`${ids}-flag`} className="flex flex-col gap-1 text-muted">
              Flag (from MMSI)
              <select
                id={`${ids}-flag`}
                value={filters.flag}
                onChange={(event) => update({ flag: event.target.value })}
                className="min-h-[2.75rem] rounded-[2px] border border-rule bg-surface px-2 text-fg"
              >
                <option value="all">All flags</option>
                {data.flags.map((flag) => (
                  <option key={flag} value={flag}>
                    {flag}
                  </option>
                ))}
              </select>
            </label>

            {data.carriers.length > 0 ? (
              <label htmlFor={`${ids}-carrier`} className="flex flex-col gap-1 text-muted">
                Carrier (from published fleet lists)
                <select
                  id={`${ids}-carrier`}
                  value={filters.carrier}
                  onChange={(event) => update({ carrier: event.target.value })}
                  className="min-h-[2.75rem] max-w-full rounded-[2px] border border-rule bg-surface px-2 text-fg"
                >
                  <option value="all">All</option>
                  {data.carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                  <option value="none">No match in the lists we hold</option>
                </select>
              </label>
            ) : null}

            <label htmlFor={`${ids}-search`} className="flex min-w-0 flex-col gap-1 text-muted">
              Name or MMSI
              <input
                id={`${ids}-search`}
                type="search"
                value={filters.search}
                onChange={(event) => update({ search: event.target.value })}
                autoComplete="off"
                spellCheck={false}
                className="min-h-[2.75rem] w-56 max-w-full rounded-[2px] border border-rule bg-surface px-2 text-fg"
              />
            </label>

            {filtering ? (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="min-h-[2.75rem] text-link underline underline-offset-2"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {data.carriers.length === 0 ? (
            <p className="mt-2 text-meta text-muted">No heard ship matched a fleet list we hold.</p>
          ) : null}
          {data.flags.length === 0 ? (
            <p className="mt-2 text-meta text-muted">No flag (from MMSI) is known for any ship in this sample.</p>
          ) : null}

          <p className="mt-3 text-meta text-muted" aria-live="polite">
            Showing <span data-numeric className="text-fg">{totalShown}</span> of{' '}
            <span data-numeric>{totalHeard}</span> ships heard at the ten chokepoints.
          </p>
        </fieldset>

        <ShipKey />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const heard = data.byNode[card.nodeId] ?? [];
          const visible = shown[card.nodeId] ?? [];
          const chosen =
            selected?.nodeId === card.nodeId ? heard.find((ship) => ship.m === selected.mmsi) ?? null : null;
          return (
            <article key={card.nodeId} id={`ships-${card.nodeId}`} className="story story-compact min-w-0 scroll-mt-8">
              {card.header}

              <div className="relative mt-3">
                {card.map}
                <svg
                  viewBox={`0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`}
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  {visible.map((ship) => {
                    const shape = SHAPE_FOR[shipCategoryOf(ship)];
                    return (
                      <g
                        key={ship.m}
                        onClick={() => setSelected({ nodeId: card.nodeId, mmsi: ship.m })}
                        className="cursor-pointer"
                      >
                        <circle cx={ship.x} cy={ship.y} r={7} fill="transparent" />
                        <ShipMark shape={shape} x={ship.x} y={ship.y} quiet={ship.u !== 1} />
                      </g>
                    );
                  })}
                  {chosen ? (
                    <circle cx={chosen.x} cy={chosen.y} r={8} fill="none" className="stroke-fg" strokeWidth={1.4} />
                  ) : null}
                </svg>
              </div>

              <p className="mt-2 text-meta text-muted">
                <span data-numeric className="text-fg">{visible.length}</span> shown of{' '}
                <span data-numeric>{heard.length}</span> heard
                {filtering ? ' (filters on)' : ''}.
              </p>

              {chosen ? <ShipDetails ship={chosen} data={data} onClose={() => setSelected(null)} /> : null}

              {heard.length > 0 ? (
                <ShipTable
                  ships={visible}
                  heard={heard.length}
                  flags={data.flags}
                  selected={chosen?.m ?? null}
                  onSelect={(mmsi) => setSelected({ nodeId: card.nodeId, mmsi })}
                />
              ) : null}

              {card.footer}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ShipKey() {
  return (
    <div className="min-w-0">
      <p className="kicker kicker-muted mb-2">Key</p>
      <ul className="space-y-1.5 text-meta text-fg">
        {SHAPE_KEY.map(({ shape, label }) => (
          <li key={shape} className="flex items-center gap-2">
            <ShipIcon shape={shape} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted">
          <ShipIcon shape="circle" quiet />
          Smaller and lighter: not under way
        </li>
        <li className="flex items-center gap-2 text-muted">
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" className="shrink-0">
            <rect x="1" y="3" width="12" height="8" fill="none" className="stroke-link" strokeDasharray="2 2" />
          </svg>
          Sampling area: ships are only heard inside it
        </li>
      </ul>
    </div>
  );
}

function ShipDetails({ ship, data, onClose }: { ship: ShipDot; data: ShipsData; onClose: () => void }) {
  const category = shipCategoryOf(ship);
  const flag = ship.f !== undefined ? data.flags[ship.f] : undefined;
  return (
    <section aria-label="Selected ship" className="mt-3 border-l-2 border-link bg-surface-2 px-3 py-2 text-meta" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-fg">{nameOf(ship)}</p>
        <button type="button" onClick={onClose} className="-mr-1 min-h-[2.75rem] min-w-[2.75rem] text-link">
          Close
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted">MMSI</dt>
        <dd data-numeric className="text-fg">{ship.m}</dd>
        <dt className="text-muted">Flag (from MMSI)</dt>
        <dd className="text-fg">{flag ?? 'Not known'}</dd>
        <dt className="text-muted">Type</dt>
        <dd className="text-fg">
          {SHIP_CATEGORY_LABELS[category]}
          <span className="text-muted">, {typeKnownHow(ship)}</span>
        </dd>
        <dt className="text-muted">Moving</dt>
        <dd className="text-fg">
          {ship.u ? 'Under way' : 'Not under way'}
          {ship.s !== undefined ? (
            <span className="text-muted">
              , <span data-numeric>{ship.s.toFixed(1)}</span> knots reported by the ship
            </span>
          ) : (
            <span className="text-muted">, speed not reported</span>
          )}
        </dd>
        {ship.g !== undefined ? (
          <>
            <dt className="text-muted">Course</dt>
            <dd className="text-fg">
              <span data-numeric>{ship.g}</span>° reported by the ship
            </dd>
          </>
        ) : null}
        <dt className="text-muted">Position heard</dt>
        <dd className="text-fg">{formatUtc(heardAt(data, ship))}</dd>
      </dl>
      {carrierIndicesOf(ship).map((index) => {
        const carrier = data.carriers[index];
        if (!carrier) return null;
        return (
          <p key={carrier.id} className="mt-2 border-t border-hairline pt-2 text-fg">
            Reports an IMO number that appears in {carrier.name}&rsquo;s published fleet list (
            {RELATIONSHIP_LABELS[carrier.relationship]} wording; list dated {formatUtcDateOnly(carrier.asOf)}; source:{' '}
            <a href={carrier.url} rel="noopener noreferrer" target="_blank" className="text-link underline underline-offset-2">
              {carrier.publisher}
            </a>
            ).
            {carrier.stale ? (
              <span className="text-muted"> The list had not been refreshed in over {CARRIER_STALE_AFTER_DAYS} days when this page was built.</span>
            ) : null}
          </p>
        );
      })}
      {ship.w ? (
        <p className="mt-1 text-muted">Names of military and law-enforcement ships are not shown.</p>
      ) : null}
    </section>
  );
}

function ShipTable({
  ships,
  heard,
  flags,
  selected,
  onSelect,
}: {
  ships: ShipDot[];
  heard: number;
  flags: string[];
  selected: string | null;
  onSelect: (mmsi: string) => void;
}) {
  const rows = ships.slice(0, TABLE_ROWS);
  const unlisted = ships.length - rows.length;
  return (
    <details className="mt-3">
      <summary className="flex min-h-[2.75rem] cursor-pointer items-center text-meta text-link">
        All <span data-numeric className="mx-1">{heard}</span> heard, as a table
      </summary>
      {ships.length === 0 ? (
        <p className="mt-2 text-meta text-muted">No ship here matches the filters.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-meta">
            <caption className="sr-only">
              Ships heard, under way first, then by MMSI. Select a ship to see its details.
            </caption>
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th scope="col" className="py-1.5 pr-3 font-normal">Ship</th>
                <th scope="col" className="py-1.5 pr-3 font-normal">Type</th>
                <th scope="col" className="py-1.5 pr-3 font-normal">Under way</th>
                <th scope="col" className="py-1.5 font-normal">Flag (from MMSI)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ship) => {
                const category = shipCategoryOf(ship);
                const flag = ship.f !== undefined ? flags[ship.f] : undefined;
                return (
                  <tr key={ship.m} className={'border-b border-hairline ' + (ship.m === selected ? 'bg-surface-2' : '')}>
                    <td className="pr-3">
                      <button
                        type="button"
                        onClick={() => onSelect(ship.m)}
                        aria-pressed={ship.m === selected}
                        className="flex min-h-[2.75rem] w-full flex-col justify-center text-left text-link"
                      >
                        <span className={ship.n ? 'text-fg' : 'text-muted'}>{nameOf(ship)}</span>
                        <span data-numeric className="text-muted">{ship.m}</span>
                      </button>
                    </td>
                    <td className="pr-3">
                      <span className="flex items-center gap-1.5 text-fg">
                        <ShipIcon shape={SHAPE_FOR[category]} quiet={ship.u !== 1} />
                        {SHIP_CATEGORY_LABELS[category]}
                      </span>
                    </td>
                    <td className="pr-3 text-fg">{ship.u ? 'Yes' : 'No'}</td>
                    <td className="text-fg">{flag ?? <span className="text-muted">Not known</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unlisted > 0 ? (
            <p className="mt-2 text-meta text-muted">
              <span data-numeric>{unlisted}</span> more not listed. Narrow the filters to see them.
            </p>
          ) : null}
        </div>
      )}
    </details>
  );
}
