/**
 * What Novus Data tracks.
 *
 * This is the one file to edit when the beat changes. The home page lists
 * titles only; /coverage reads the rest. Nothing else hardcodes a topic, so
 * adding, cutting or reordering a topic here is the whole job.
 *
 * PROVENANCE: drafted from the project description, not supplied by the
 * author — see INPUT_LEDGER in publication.ts. Confirm or rewrite before
 * launch. Deliberately free of numbers: the site states no figure it cannot
 * source (Rule 1).
 */

export interface CoverageTopic {
  /** URL fragment, used for in-page anchors on /coverage. Keep it stable. */
  id: string;
  title: string;
  /** One line. Not rendered at present; the home page lists titles only. */
  summary: string;
  /** What the thing actually is, in plain terms. */
  definition: string;
  /**
   * Why each reader group cares. Keyed loosely to the reader definitions in
   * publication.ts — an investor and a procurement manager care about port
   * congestion for different reasons, so both are stated.
   */
  whyItMatters: {
    toInvestors: string;
    toOperators: string;
  };
  /** What a Novus Data briefing actually says about it. */
  whatIsReported: string;
}

export const coverageTopics: CoverageTopic[] = [
  {
    id: 'freight-rates',
    title: 'Container shipping and freight rates',
    summary: 'Spot and contract rates on the main lanes, and the capacity carriers deploy against them.',
    definition:
      'What it costs to move a container on the major east–west and north–south lanes, and the supply side that sets that price: vessel orderbooks, blank sailings, alliance reshuffles, idle tonnage and scrapping.',
    whyItMatters: {
      toInvestors:
        'Freight is one of the few prices that responds to a physical disruption within days rather than quarters. A sustained move is an early read on inventory decisions that retailers and manufacturers will not describe for another reporting cycle, and it lands in gross margin on a predictable lag.',
      toOperators:
        'It is a direct line item and a planning input. The gap between the spot market and contract rates is what decides whether to lock in a rate now or ride the index, and that decision is usually made months before the cost appears.',
    },
    whatIsReported:
      'Which lane moved, by how much relative to its own recent range, and whether capacity or demand is doing the work — the two have different half-lives. Where a comparable episode has happened before, what followed it.',
  },
  {
    id: 'chokepoints',
    title: 'Chokepoints and canal transits',
    summary: 'Suez, Panama, Bab el-Mandeb, Hormuz, Malacca — and the conditions that throttle them.',
    definition:
      'The narrow passages a large share of seaborne trade has to cross, and everything that changes how much gets through them: draught and slot restrictions, drought, security conditions, war-risk insurance, and the transit-booking rules canal authorities set.',
    whyItMatters: {
      toInvestors:
        'A throttled chokepoint does not only delay cargo, it absorbs vessel capacity. A longer voyage ties up the same ship for more days, which tightens effective supply across the whole market rather than one route. The sequence is usually freight and war-risk premiums first, delivery times second, and input costs for whoever sits at the end of that lane third.',
      toOperators:
        'A rerouting adds weeks to transit time, which changes safety stock, working capital and every promise made to a customer downstream of it. The routing decision often has to be made before the disruption is confirmed.',
    },
    whatIsReported:
      'What actually changed at the passage, what share of traffic it carries, which routes absorb the diversion, and how long the constraint has historically taken to clear.',
  },
  {
    id: 'ports',
    title: 'Ports, terminals and inland connections',
    summary: 'Throughput and dwell time at major ports, and the rail and road that clear them.',
    definition:
      'How much cargo is moving across the major container and bulk terminals, how long it sits once landed, and the condition of the rail, barge and trucking capacity that has to take it inland. Congestion is rarely only at the quayside.',
    whyItMatters: {
      toInvestors:
        'Dwell time is a cleaner read than volume on whether goods are genuinely moving. Sustained congestion at a gateway port pulls forward ordering, distorts the next quarter of import data, and tends to show up as an inventory swing that gets misread as demand.',
      toOperators:
        'Dwell time is schedule risk, and the inland leg is where it usually compounds. A terminal clearing normally with no chassis or rail capacity behind it is still a delay.',
    },
    whatIsReported:
      'Where queues are forming, whether the cause is labour, equipment, weather or volume — they resolve on very different timescales — and what the inland network looks like behind the berth.',
  },
  {
    id: 'trade-policy',
    title: 'Trade policy, tariffs and export controls',
    summary: 'Tariffs, sanctions and licensing rules, read for scope and effective date rather than headline.',
    definition:
      'Tariffs, quotas, sanctions, export licensing and the administrative machinery that decides what a measure actually costs: effective dates, exclusion processes, de minimis thresholds, rules of origin and tariff classification.',
    whyItMatters: {
      toInvestors:
        'The announcement is not the event. Scope, effective date and the substitution available to the affected buyer decide whether a measure is a cost pass-through, a margin hit or noise. Most of that is in the text of the measure and almost none of it is in the headline.',
      toOperators:
        'Classification and rules of origin set the landed cost line by line. An exclusion process, a tariff engineering option or a change of origin can be worth more than any hedge, and all of them run on published deadlines.',
    },
    whatIsReported:
      'What a measure actually covers, the date it binds, who is exposed on each side of it, and what is realistically substitutable within the time the rule allows.',
  },
  {
    id: 'critical-inputs',
    title: 'Critical minerals and industrial inputs',
    summary: 'Concentrated upstream supply, and the refining steps where the concentration bites.',
    definition:
      'The materials whose supply, or more often whose processing and refining, is concentrated in very few places — and the qualification and contracting practices that make substituting them slow.',
    whyItMatters: {
      toInvestors:
        'Concentration is the risk, and it usually sits a step further upstream than expected: refining rather than mining, a single grade rather than a metal. One export-licensing decision can reprice a downstream sector that looked diversified.',
      toOperators:
        'Qualifying an alternative supplier takes quarters, sometimes years, and the qualification has to start before the shortage. Knowing where a single point of failure sits is the whole of the mitigation.',
    },
    whatIsReported:
      'Where supply and processing are actually concentrated, what the realistic alternatives are, and how long switching to them takes in practice.',
  },
  {
    id: 'energy-costs',
    title: 'Energy and bunker costs',
    summary: 'The fuel cost of moving goods, and the regulation attached to it.',
    definition:
      'Marine fuel prices and the spreads between fuel grades, plus the regulatory costs now attached to them — emissions schemes, fuel-sulphur limits and the compliance choices they force on operators.',
    whyItMatters: {
      toInvestors:
        'Fuel is the largest variable cost in shipping, so it sets a floor under freight rates. It also sets vessel speed: when fuel is expensive ships slow down, which removes effective capacity from the market without a single vessel leaving it.',
      toOperators:
        'Bunker surcharges pass through on a lag and on a formula. Knowing the formula matters more than knowing the spot price.',
    },
    whatIsReported:
      'The level, the grade spreads, the regulatory cost being added, and what each implies for freight and for sailing speed.',
  },
  {
    id: 'macro',
    title: 'The macro data trade moves through',
    summary: 'The releases that describe physical trade, read for the trade components rather than the headline.',
    definition:
      'The economic releases that actually say something about goods moving: manufacturing survey components on new export orders and supplier delivery times, inventories-to-sales, industrial production, and customs trade data.',
    whyItMatters: {
      toInvestors:
        'These are what turn a single disruption into an economy-wide read. A supplier-delivery-times component stretching at the same time as a chokepoint closes is a different story from either one alone.',
      toOperators:
        'They answer the question that decides the response: is this a supply constraint that will clear, or demand that has already turned?',
    },
    whatIsReported:
      'What the release said about trade specifically — the components, not the headline — and whether it confirms or contradicts what the physical indicators are showing.',
  },
];
