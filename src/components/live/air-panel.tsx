import { ReadingBlock } from '@/components/live/reading-block';
import { ExternalLink } from '@/components/text-link';
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS, type AirData } from '@/lib/live/air';
import { AIR_NODES } from '@/lib/live/air-nodes';
import { formatUtc, formatUtcDateOnly } from '@/lib/live/display';
import { SOURCE_META } from '@/lib/live/meta';
import type { Reading } from '@/lib/live/types';

/**
 * "Aircraft at air-cargo hubs" on /monitor (Vessels Part 3B). Server only;
 * no client component and no map: counts and tables are the deliverable.
 *
 * HIDDEN on two counts: the page's `monitorEnabled` gate, and OpenSky's terms,
 * which are unconfirmed for a product that may charge. Do not take it public
 * until both founders hold OpenSky's written answer (DECISIONS.md).
 *
 * Unmatched aircraft are counted, never identified: their callsign and
 * transponder address are not in AirData at all. A flight is listed only when
 * its callsign begins with a designator from an operator record citing FAA
 * Order JO 7340.2, and then as an inference, never as an identification. No
 * cargo claim, ever.
 */
export function AirPanel({ reading }: { reading: Reading<AirData> }) {
  return (
    <>
      <div className="mb-5 max-w-[72ch] space-y-2 text-[0.9375rem] leading-[1.55] text-muted">
        <p>
          Aircraft heard inside a box around each of eight air-cargo hubs, drawn from their own transponder
          broadcasts. Receiver coverage is uneven, so a zero means no signal was received, not an empty sky.
        </p>
        <p>
          Cargo is not shown and cannot be: passenger airlines carry freight in their holds, and cargo airlines also
          fly empty. An aircraft is listed by name only when its callsign begins with a three-letter designator the
          FAA lists for an operator loaded here, which is an inference: aircraft are sometimes flown for one airline
          under another&rsquo;s designator. Every other aircraft is counted, not identified.
        </p>
        <p className="text-meta">Terms: {SOURCE_META.opensky.terms}</p>
      </div>
      <ReadingBlock reading={reading}>{(data) => <AirBody data={data} />}</ReadingBlock>
    </>
  );
}

function AirBody({ data }: { data: AirData }) {
  const operatorName = new Map(data.operators.map((o) => [o.id, o]));
  return (
    <>
      {data.designatorsLoaded === 0 ? (
        <p className="mb-4 max-w-[72ch] text-[0.9375rem] text-muted">
          No operator designators are loaded yet, so every aircraft below is counted, not identified.
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {AIR_NODES.map((node) => {
          const reading = data.nodes.find((n) => n.nodeId === node.id);
          const total = reading?.total ?? 0;
          const rows = AIRCRAFT_CATEGORIES.map((category) => ({
            category,
            airborne: reading?.airborne[category] ?? 0,
            ground: reading?.onGround[category] ?? 0,
          })).filter((row) => row.airborne + row.ground > 0);
          return (
            <article key={node.id} id={`air-${node.id}`} className="story story-compact min-w-0">
              <p className="kicker">Air hub</p>
              <h3 className="story-title mt-1.5">
                {node.name} <span className="text-muted">({node.iata})</span>
              </h3>
              {total === 0 ? (
                <p className="mt-2 text-meta text-fg">
                  No signal in this sample.{' '}
                  <span className="text-muted">A zero means no aircraft was heard here, not an empty sky.</span>
                </p>
              ) : (
                <>
                  <p className="mt-2 text-meta text-fg">
                    <span data-numeric>{total}</span> heard.
                  </p>
                  <table className="mt-2 w-full border-collapse text-meta">
                    <caption className="sr-only">Aircraft heard near {node.name}, by category</caption>
                    <thead>
                      <tr className="border-b border-rule text-left text-muted">
                        <th scope="col" className="py-1 pr-2 font-normal">Category</th>
                        <th scope="col" className="py-1 pr-2 text-right font-normal">Airborne</th>
                        <th scope="col" className="py-1 text-right font-normal">On the ground</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.category} className="border-b border-hairline text-fg">
                          <th scope="row" className="py-1 pr-2 text-left font-normal">{AIRCRAFT_CATEGORY_LABELS[row.category]}</th>
                          <td className="py-1 pr-2 text-right"><span data-numeric>{row.airborne}</span></td>
                          <td className="py-1 text-right"><span data-numeric>{row.ground}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {reading && reading.matched.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-hairline pt-2 text-meta">
                  {reading.matched.map((flight) => {
                    const operator = operatorName.get(flight.operatorId);
                    return (
                      <li key={flight.icao24} className="text-fg">
                        <span data-numeric>{flight.callsign}</span>{' '}
                        <span className="text-muted">
                          ({flight.onGround ? 'on the ground' : 'airborne'}, heard {formatUtc(flight.seenAt)})
                        </span>
                        {operator ? (
                          <span className="block text-muted">
                            Callsign begins with {flight.designator}, the designator the FAA lists for {operator.name} (
                            <ExternalLink href={operator.url}>{operator.publisher}</ExternalLink>, list dated{' '}
                            {formatUtcDateOnly(operator.asOf)}).
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
