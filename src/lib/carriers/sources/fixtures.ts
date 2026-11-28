/**
 * A sample carrier for `npm run dev:demo` and the tests. Fenced like every
 * other fixture (CLAUDE.md Rule 1): reachable only with
 * CONTENT_SOURCE=fixtures, every name prefixed [SAMPLE], and a production build
 * that touches this file throws at module load.
 *
 * The IMO numbers are in the 100000x range with valid check digits, matching
 * the sample ships in src/lib/live/sources/fixtures.ts. Real ship IMO numbers
 * are believed to start far higher, but that could not be checked from the
 * environment this was written in; it is the least collision-prone choice
 * available, and the names say [SAMPLE] regardless.
 */

import type { CarrierRecord } from '../types';

if (process.env.NODE_ENV === 'production' && process.env.CONTENT_SOURCE === 'fixtures') {
  throw new Error('CONTENT_SOURCE=fixtures must never be used for a production build. Carrier fixtures are sample data.');
}

/** The IMO numbers the sample ships broadcast. 1000007 and 1000019 are listed below; 1000021 is not. */
export const FIXTURE_IMO = { listed: 1_000_007, listedTwice: 1_000_019, unlisted: 1_000_021 } as const;

const common = {
  sourceLabel: '[SAMPLE] Our fleet',
  retrieved: '2026-11-20',
  sources: [{ url: 'https://example.invalid/fleet', publisher: '[SAMPLE] Example Lines' }],
  termsChecked: { on: '2026-11-20', note: '[SAMPLE] Not a real page; no terms apply.' },
  designators: [],
};

export function fixtureCarriers(): CarrierRecord[] {
  return [
    {
      ...common,
      id: 'sample-example-lines',
      name: '[SAMPLE] Example Lines',
      kind: 'shipping-line',
      relationship: 'operated',
      asOf: '2026-11-15',
      imo: [FIXTURE_IMO.listed, FIXTURE_IMO.listedTwice],
    },
    {
      ...common,
      id: 'sample-old-owners',
      name: '[SAMPLE] Old Owners Shipping',
      kind: 'shipping-line',
      relationship: 'owned',
      // Deliberately older than CARRIER_STALE_AFTER_DAYS, so the stale note shows.
      asOf: '2026-01-10',
      imo: [FIXTURE_IMO.listedTwice],
    },
  ];
}
