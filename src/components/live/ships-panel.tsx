import { CHOKEPOINT_LAND } from '@/components/chokepoint-land';
import { type PlaceRegisterEntry } from '@/components/live/place-board';
import { ReadingBlock } from '@/components/live/reading-block';
import { SHAPE_FOR, ShipIcon } from '@/components/live/ship-shapes';
import { ShipsExplorer, type ShipCard } from '@/components/live/ships-explorer';
import { StatusBadge } from '@/components/status-badge';
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
  const seconds = reading.status === 'ok' ? reading.data.windowSeconds : 30;
  return (
    <div className="mb-5 max-w-[72ch] space-y-2 text-[0.9375rem] leading-[1.55] text-muted">
      <p>
        Each ship below is drawn where it reported itself during one {seconds}-second sample, taken
        about every fifteen minutes, so ships move on between samples. The picture shows traffic, not
        cargo.
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
  const ships = toShipsData(data.vessels, BOXES);
  const total = data.vessels.length;

  const cards: ShipCard[] = CHOKEPOINTS.filter((node) => node.box).map((node) => {
    const records = data.vessels.filter((record) => record.nodeId === node.id);
    return {
      nodeId: node.id,
      name: node.name,
      header: <CardHeader name={node.name} note={node.note} records={records} />,
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
      <ShipsExplorer data={ships} cards={cards} />
    </>
  );
}

function CardHeader({ name, note, records }: { name: string; note?: string; records: VesselRecord[] }) {
  const moving = records.filter(underway).length;
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
