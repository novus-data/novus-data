import { CHOKEPOINT_LAND } from '@/components/chokepoint-land';
import { type PlaceRegisterEntry } from '@/components/live/place-board';
import { ReadingBlock } from '@/components/live/reading-block';
import { SHAPE_FOR, ShipIcon } from '@/components/live/ship-shapes';
import { ShipsExplorer, type ShipCard } from '@/components/live/ships-explorer';
import { StatusBadge } from '@/components/status-badge';
import { RELATIONSHIP_LABELS, type CarrierSummary } from '@/lib/carriers/types';
import { formatUtcDateOnly } from '@/lib/live/display';
import { TextLink } from '@/components/text-link';
import { CHOKEPOINTS } from '@/lib/live/nodes';
import { PANEL_HEIGHT, PANEL_WIDTH, boxRect, panelWindow } from '@/lib/live/panel-geo';
import type { BoundingBox, Reading } from '@/lib/live/types';
import { toShipsData } from '@/lib/live/vessel-filter';
import {
  SHIP_CATEGORIES,
  SHIP_CATEGORY_LABELS,
  VESSEL_UNDERWAY_KNOTS,
  type VesselFeedData,
  type VesselRecord,
} from '@/lib/live/vessels';

/**
 * "Ships at the chokepoints" on /monitor: one panel per chokepoint, ships
 * drawn by shape, with filters, and the open register entries that name each
 * place. CLAUDE.md §6a, "The ships panel".
 *
 * Server-rendered: the copy, each card's heading, summary, counts-by-type
 * table, coastline and register links. Only the filters, marks and tables in
 * ShipsExplorer run in the browser, so without JavaScript every number here
 * is still on the page.
 *
 * Every figure is computed from the sample. The join to the register is by
 * PLACE only: a ship is never connected to a company, by proximity, name or
 * anything else (src/lib/live/nodes.ts says why).
 */

const BOXES: Record<string, BoundingBox> = Object.fromEntries(
  CHOKEPOINTS.flatMap((node) => (node.box ? [[node.id, node.box] as const] : [])),
);

export function ShipsPanel({
  reading,
  register,
}: {
  reading: Reading<VesselFeedData>;
  register: Record<string, PlaceRegisterEntry[]>;
}) {
  return (
    <>
      <ShipsIntro reading={reading} />
      <ReadingBlock reading={reading}>{(data) => <ShipsBody data={data} register={register} />}</ReadingBlock>
    </>
  );
}

function ShipsIntro({ reading }: { reading: Reading<VesselFeedData> }) {
  return (
    <div className="mb-5 max-w-[72ch] space-y-2 text-[0.9375rem] leading-[1.55] text-muted">
      <p>
        {reading.status === 'ok'
          ? `Each ship below is drawn where it reported itself during one ${reading.data.windowSeconds}-second sample, taken about every fifteen minutes, so ships move on between samples.`
          : 'When this is switched on, each ship is drawn where it reported itself during one short sample, taken about every fifteen minutes.'}{' '}
        The picture shows traffic, not cargo.
      </p>
      <p>
        Everything here is reported by the ship: its position, speed and type. None of it is checked,
        and positions can be wrong or deliberately falsified; GPS interference is documented in the Gulf
        and the Red Sea.
      </p>
      <p>
        Coverage comes from receivers on land near the coast and is thin offshore. A gap or a zero means
        no signal was received, not that no ship was there. Ships that are not under way broadcast far
        less often, so they are under-represented.
      </p>
      <p>
        Type is the category the ship broadcasts about itself. It says nothing about what it is
        carrying: a cargo ship may be empty. Flag (from MMSI) comes from the first digits of the
        ship&rsquo;s identifier, and usually, but not always, matches the country it is registered in.
      </p>
    </div>
  );
}

function underway(record: VesselRecord): boolean {
  return record.sog !== null && record.sog >= VESSEL_UNDERWAY_KNOTS;
}

function ShipsBody({ data, register }: { data: VesselFeedData; register: Record<string, PlaceRegisterEntry[]> }) {
  const ships = toShipsData(data.vessels, BOXES, data.carriers);
  const listsHeld = data.carriers.filter((carrier) => carrier.kind === 'shipping-line');
  const total = data.vessels.length;

  const cards: ShipCard[] = CHOKEPOINTS.filter((node) => node.box).map((node) => {
    const records = data.vessels.filter((record) => record.nodeId === node.id);
    return {
      nodeId: node.id,
      name: node.name,
      header: <CardHeader name={node.name} note={node.note} records={records} listsHeld={listsHeld.length > 0} />,
      map: <CardMap nodeId={node.id} box={node.box!} />,
      footer: <CardRegister entries={register[node.id] ?? []} />,
    };
  });

  return (
    <>
      <p className="mb-4 max-w-[72ch] text-[0.9375rem] text-muted">
        {total === 0 ? (
          'No ship was heard in any box during this sample.'
        ) : (
          <>
            Type known for <span data-numeric className="text-fg">{data.typeKnown}</span> of{' '}
            <span data-numeric>{total}</span> ships heard (<span data-numeric>{data.typeFromSample}</span> reported in
            this sample, <span data-numeric>{data.typeFromRegistry}</span> from earlier reports). Ships send their type
            only every few minutes, so a short sample hears few of them; where earlier reports are kept, the share
            rises over time.
          </>
        )}
      </p>
      <CarrierLists carriers={listsHeld} matched={data.carrierMatched} total={total} />
      <ShipsExplorer data={ships} cards={cards} />
    </>
  );
}

function CardHeader({
  name,
  note,
  records,
  listsHeld,
}: {
  name: string;
  note?: string;
  records: VesselRecord[];
  listsHeld: boolean;
}) {
  const moving = records.filter(underway).length;
  const matched = records.filter((record) => record.carrierIds.length > 0).length;
  const known = records.filter((record) => record.typeSource !== 'unknown').length;
  const counts = SHIP_CATEGORIES.map((category) => ({
    category,
    count: records.filter((record) => record.category === category).length,
  })).filter((row) => row.count > 0);

  return (
    <header>
      <p className="kicker">Chokepoint</p>
      <h3 className="story-title mt-1.5">{name}</h3>
      {records.length === 0 ? (
        <p className="mt-2 text-meta text-fg">
          No signal in this sample.{' '}
          <span className="text-muted">A zero means no ship was heard here, not an empty sea.</span>
        </p>
      ) : (
        <p className="mt-2 text-meta text-fg">
          <span data-numeric>{records.length}</span> heard, <span data-numeric>{moving}</span> under way; type known
          for <span data-numeric>{known}</span>.
        </p>
      )}
      {listsHeld && records.length > 0 ? (
        <p className="mt-1 text-meta text-muted">
          <span data-numeric className="text-fg">{matched}</span> of <span data-numeric>{records.length}</span> heard
          matched to a listed fleet; the rest are unmatched, not unaffiliated.
        </p>
      ) : null}
      {note ? <p className="mt-1 text-meta text-muted">{note}</p> : null}
      {counts.length > 0 ? (
        <table className="mt-2 w-full border-collapse text-meta">
          <caption className="sr-only">Ships heard at {name}, by type</caption>
          <tbody>
            {counts.map(({ category, count }) => (
              <tr key={category} className="border-t border-hairline">
                <th scope="row" className="py-1 pr-3 text-left font-normal text-fg">
                  <span className="flex items-center gap-1.5">
                    <ShipIcon shape={SHAPE_FOR[category]} />
                    {SHIP_CATEGORY_LABELS[category]}
                  </span>
                </th>
                <td className="py-1 text-right text-fg">
                  <span data-numeric>{count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </header>
  );
}

function CardMap({ nodeId, box }: { nodeId: string; box: BoundingBox }) {
  const window = panelWindow(nodeId, box);
  const rect = boxRect(window);
  return (
    <svg viewBox={`0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`} className="block h-auto w-full" aria-hidden="true">
      <rect width={PANEL_WIDTH} height={PANEL_HEIGHT} className="fill-ink" />
      <path
        d={CHOKEPOINT_LAND[nodeId] ?? ''}
        fillRule="evenodd"
        className="fill-surface-2 stroke-rule"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        className="stroke-link"
        strokeOpacity={0.7}
        strokeWidth={0.8}
        strokeDasharray="3 3"
      />
      <text x={rect.x + 3} y={rect.y - 3} className="fill-muted" fontSize={8.5}>
        sampling area
      </text>
    </svg>
  );
}

function CardRegister({ entries }: { entries: PlaceRegisterEntry[] }) {
  return (
    <footer className="mt-3 border-t border-hairline pt-2 text-meta">
      {entries.length === 0 ? (
        <p className="text-muted">No open register entry names this place.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-2">
              <StatusBadge status={entry.status} />
              <TextLink href={`/disruptions/${entry.id}`}>{entry.title}</TextLink>
            </li>
          ))}
        </ul>
      )}
    </footer>
  );
}

/**
 * The fleet lists Novus holds: the point of the carrier matching. Every list
 * shows its own wording, date, size and source, so a reader can check any
 * match against the carrier's own page. No logos, no colours: words only.
 */
function CarrierLists({ carriers, matched, total }: { carriers: CarrierSummary[]; matched: number; total: number }) {
  return (
    <div className="mb-5 max-w-[72ch] text-[0.9375rem] leading-[1.55] text-muted">
      <h3 className="kicker kicker-muted mb-2">Carrier fleet lists</h3>
      {carriers.length === 0 ? (
        <p>Novus has not loaded any carrier fleet lists yet, so no ship is matched to a carrier.</p>
      ) : (
        <>
          <p>
            A match means a ship&rsquo;s broadcast IMO number appears in that carrier&rsquo;s own published list. It
            does not show who is carrying what, and a line carries other firms&rsquo; cargo. The IMO number is typed
            in by the crew and can be wrong or falsified. Lists are held for only the carriers below, so a ship with no
            match may belong to any carrier, or to none loaded here. Lists change; each shows its own date. A
            carrier&rsquo;s ship at a place is not a statement that the carrier is affected by anything happening
            there.
          </p>
          <p className="mt-2">
            <span data-numeric className="text-fg">{matched}</span> of <span data-numeric>{total}</span> ships heard
            matched a list.
          </p>
          <details className="mt-2">
            <summary className="flex min-h-[2.75rem] cursor-pointer items-center text-meta text-link">
              The <span data-numeric className="mx-1">{carriers.length}</span> lists held
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-meta">
                <caption className="sr-only">Carrier fleet lists held, with their wording, date, size and source</caption>
                <thead>
                  <tr className="border-b border-rule text-left text-muted">
                    <th scope="col" className="py-1.5 pr-3 font-normal">Carrier</th>
                    <th scope="col" className="py-1.5 pr-3 font-normal">Wording</th>
                    <th scope="col" className="py-1.5 pr-3 font-normal">List dated</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">IMO entries</th>
                    <th scope="col" className="py-1.5 font-normal">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {carriers.map((carrier) => (
                    <tr key={carrier.id} className="border-b border-hairline align-top text-fg">
                      <td className="py-1.5 pr-3">{carrier.name}</td>
                      <td className="py-1.5 pr-3">{RELATIONSHIP_LABELS[carrier.relationship]}</td>
                      <td className="py-1.5 pr-3">
                        {formatUtcDateOnly(carrier.asOf)}
                        {carrier.stale ? (
                          <span className="block text-muted">Had not been refreshed when this page was built.</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <span data-numeric>{carrier.entries}</span>
                      </td>
                      <td className="py-1.5">
                        <a href={carrier.sources[0].url} rel="noopener noreferrer" target="_blank" className="text-link underline underline-offset-2">
                          {carrier.sources[0].publisher}
                        </a>
                        <span className="block text-muted">{carrier.sourceLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
