/**
 * Regression tests for aircraft at air-cargo hubs (Vessels Part 3B):
 * src/lib/live/air.ts, air-nodes.ts, sources/opensky.ts, readAirFeed, the air
 * panel, the FAA citation rule for operator records, and the NEXT_PUBLIC_
 * guard for live-data credentials. No network: OpenSky is a mock fetch.
 */

import assert from 'node:assert/strict';

const CANARY_ID = 'CANARY-CLIENT-ID-4d1f';
const CANARY_SECRET = 'CANARY-CLIENT-SECRET-9b2e';

async function main() {
  Object.assign(process.env, { NODE_ENV: 'development' });
  delete process.env.CONTENT_SOURCE;
  delete process.env.OPENSKY_CLIENT_ID;
  delete process.env.OPENSKY_CLIENT_SECRET;

  const air = await import('@/lib/live/air');
  const { AIR_NODES, boxArea } = await import('@/lib/live/air-nodes');

  // --- 1. callsignDesignator and sanitising ---------------------------------
  assert.equal(air.callsignDesignator('FDX1234 '), 'FDX');
  assert.equal(air.callsignDesignator('ups5'), 'UPS', 'case-folded');
  assert.equal(air.callsignDesignator('N123AB'), null, 'registration');
  assert.equal(air.callsignDesignator('GABCD'), null, 'registration');
  assert.equal(air.callsignDesignator('AB1234'), null, 'two letters');
  assert.equal(air.callsignDesignator('ABCD123'), null, 'four letters');
  assert.equal(air.callsignDesignator(''), null);
  assert.equal(air.callsignDesignator(null), null);
  assert.equal(air.callsignDesignator('   '), null);
  assert.equal(air.callsignDesignator('<b>x</b>'), null, 'hostile text');
  assert.equal(air.callsignDesignator('ZZZ1\u0000\u0007'), 'ZZZ', 'controls stripped');
  assert.equal(air.sanitiseCallsign('ABCDEFGHIJ'), null, 'over 8 characters');
  assert.equal(air.sanitiseCallsign('ZZZ1234 '), 'ZZZ1234');
  console.log('PASS callsignDesignator: commercial pattern, registrations, empty, padded, hostile');

  // --- 2. Category table -----------------------------------------------------
  assert.equal(air.aircraftCategory(6), 'heavy');
  assert.equal(air.aircraftCategory(5), 'large');
  assert.equal(air.aircraftCategory(4), 'large');
  assert.equal(air.aircraftCategory(3), 'small');
  assert.equal(air.aircraftCategory(2), 'light');
  assert.equal(air.aircraftCategory(8), 'rotorcraft');
  assert.equal(air.aircraftCategory(14), 'other');
  for (const code of [0, 1, 13, 99, -1, 'x', null, undefined]) assert.equal(air.aircraftCategory(code), 'unknown', `code ${String(code)}`);
  for (const code of [16, 17, 18, 19, 20]) assert.equal(air.aircraftCategory(code), null, 'surface vehicles and obstacles are not aircraft');
  console.log('PASS aircraftCategory: OpenSky codes to coarse categories; surface vehicles excluded');

  // --- 3. Boxes ----------------------------------------------------------------
  assert.equal(AIR_NODES.length, 8);
  for (const node of AIR_NODES) {
    assert.ok(boxArea(node.box) <= 25, `${node.id} box ${boxArea(node.box)} sq deg`);
    const [[s, w], [n, e]] = node.box;
    assert.ok(node.lat > s && node.lat < n && node.lon > w && node.lon < e, `${node.id} centre inside its box`);
  }
  console.log('PASS air nodes: eight boxes, each well under 25 square degrees, centred on the airport');

  // --- 4. Parser ---------------------------------------------------------------
  const mem = AIR_NODES.find((n) => n.id === 'memphis')!;
  const t = 1_764_288_000;
  const row = (over: Record<number, unknown>) => {
    const base: unknown[] = ['abc123', 'ZZZ1 ', 'X', t, t + 5, -89.98, 35.05, 3000, false, 120, 90, 0, null, 3050, null, false, 0, 6];
    for (const [k, v] of Object.entries(over)) base[Number(k)] = v;
    return base;
  };
  assert.deepEqual(air.parseStates({ states: null }, mem).sightings, [], 'null states is an empty sky');
  assert.equal(air.parseStates({ time: t, states: null }, mem).responseTime, new Date(t * 1000).toISOString(), 'response time kept');
  // An empty sky everywhere: the age is OpenSky's own response time, never our clock.
  const { buildAirReading: build } = await import('@/lib/live/sources');
  const emptySky = await build(AIR_NODES.map((n) => air.parseStates({ time: t, states: null }, n)), []);
  assert.ok(emptySky.status === 'ok' && emptySky.asOf === new Date(t * 1000).toISOString());
  await assert.rejects(build([air.parseStates({ states: null }, mem)], []), /no time/);
  assert.deepEqual(air.parseStates(null, mem).sightings, []);
  const parsed = air.parseStates(
    {
      states: [
        row({}),
        row({ 0: 'abc124', 5: null, 6: null }),
        row({ 0: 'abc125', 3: null }),
        row({ 0: 'abc126', 6: 95 }),
        row({ 0: 'abc127', 8: 'no' }),
        row({ 0: 'zzzzzz' }),
        'not a row',
        row({ 0: 'abc128', 17: 17 }),
        row({ 0: 'abc129', 6: 50 }),
        row({ 0: 'abc130', 3: null, 4: null }),
      ],
    },
    mem,
  );
  assert.equal(parsed.sightings.length, 2);
  assert.equal(parsed.sightings[0].timeBasis, 'position');
  assert.equal(parsed.sightings[0].seenAt, new Date(t * 1000).toISOString(), 'time from the data, not our clock');
  assert.equal(parsed.sightings[1].timeBasis, 'last-contact', 'null time_position uses last_contact');
  assert.deepEqual(parsed.dropped, { noPosition: 1, malformed: 5, notAircraft: 1, outsideBox: 1 });
  console.log('PASS parseStates: null states, null position, null time_position, wrong types, out of range, outside box');

  // --- 5. The adapter against a mock: sequential, 401 once, 429 stops ----------
  const { fetchOpenSky, OPENSKY_TOKEN_URL } = await import('@/lib/live/sources/opensky');
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const mock = (script: (url: string, n: number) => Response) => {
    let n = 0;
    return (async (input: string | URL | Request) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      const url = String(input);
      calls.push(url);
      n += 1;
      inFlight -= 1;
      return script(url, n);
    }) as typeof fetch;
  };
  const tokenOk = () => Response.json({ access_token: 'tok', expires_in: 1800 });
  const empty = () => Response.json({ time: t, states: null });

  const happy = await fetchOpenSky(CANARY_ID, CANARY_SECRET, { fetchImpl: mock((url) => (url === OPENSKY_TOKEN_URL ? tokenOk() : empty())) });
  assert.equal(happy.requests, 9, 'one token and one query per box');
  assert.equal(calls.filter((u) => u === OPENSKY_TOKEN_URL).length, 1);
  assert.equal(maxInFlight, 1, 'sequential, never a burst');
  for (const node of AIR_NODES) assert.ok(calls.some((u) => u.includes(`lamin=${node.box[0][0]}`) && u.includes('extended=true')), node.id);

  calls.length = 0;
  const refreshed = await fetchOpenSky(CANARY_ID, CANARY_SECRET, {
    fetchImpl: mock((url, n) => (url === OPENSKY_TOKEN_URL ? tokenOk() : n === 2 ? new Response(null, { status: 401 }) : empty())),
  });
  assert.equal(refreshed.results.length, 8);
  assert.equal(calls.filter((u) => u === OPENSKY_TOKEN_URL).length, 2, 'a 401 fetches one new token');

  calls.length = 0;
  const outOfCredits = await fetchOpenSky(CANARY_ID, CANARY_SECRET, {
    fetchImpl: mock((url, n) => (url === OPENSKY_TOKEN_URL ? tokenOk() : n === 3 ? new Response(null, { status: 429 }) : empty())),
  }).then(() => 'resolved', (e: Error) => e.message);
  assert.match(outOfCredits, /allowance is used up/);
  assert.equal(calls.length, 3, 'a 429 stops at once: no retry loop');

  const badToken = await fetchOpenSky(CANARY_ID, CANARY_SECRET, {
    fetchImpl: mock(() => new Response(`invalid client ${CANARY_ID} ${CANARY_SECRET}`, { status: 401 })),
  }).then(() => 'resolved', (e: Error) => e.message);
  assert.match(badToken, /refused an access token/);
  assert.ok(!badToken.includes(CANARY_ID) && !badToken.includes(CANARY_SECRET), 'upstream text not echoed');
  console.log('PASS adapter: one token, one query per box, sequential; a 401 refreshes once; a 429 stops with no retry');

  // --- 6. Not configured: no network call --------------------------------------
  const { readAirFeed, buildAirReading } = await import('@/lib/live/sources');
  const realFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error('no network in tests');
  }) as typeof fetch;
  try {
    const off = await readAirFeed();
    assert.equal(off.status, 'not-configured');
    process.env.OPENSKY_CLIENT_ID = CANARY_ID; // one of two set: still not configured
    assert.equal((await readAirFeed()).status, 'not-configured');
    assert.equal(networkCalls, 0, 'no call without both credentials');
    // Both set, network refused: unavailable, and neither credential in the output.
    process.env.OPENSKY_CLIENT_SECRET = CANARY_SECRET;
    const failed = await readAirFeed();
    assert.equal(failed.status, 'unavailable');
    const text = JSON.stringify(failed);
    assert.ok(!text.includes(CANARY_ID) && !text.includes(CANARY_SECRET), 'canary credentials not in the reading');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENSKY_CLIENT_ID;
    delete process.env.OPENSKY_CLIENT_SECRET;
  }
  console.log('PASS readAirFeed: not configured without both credentials, no network call; failures carry no credential');

  // --- 7. Privacy default and render, on the fixtures ---------------------------
  process.env.CONTENT_SOURCE = 'fixtures';
  const feed = await readAirFeed();
  assert.equal(feed.status, 'ok');
  if (feed.status !== 'ok') throw new Error('unreachable');
  const serialised = JSON.stringify(feed);
  // Unmatched aircraft: identifiers appear nowhere.
  for (const hidden of ['000a03', 'QQQ5501', '000a04', 'N123AB', '000a05', '000b01', 'QQQ210', '000c02', 'RRR9', '000d01', 'SSS33', '000f11', '000f21', '000f22', '<b>x</b>']) {
    assert.ok(!serialised.includes(hidden), `unmatched identifier in the reading: ${hidden}`);
  }
  const memphis = feed.data.nodes.find((n) => n.nodeId === 'memphis')!;
  assert.deepEqual(memphis.matched.map((f) => f.callsign).sort(), ['ZZZ1234', 'ZZZ88'], 'matched only by designator');
  assert.equal(memphis.total, 5, 'the dropped surface vehicle and the no-position row are not counted');
  assert.equal(feed.data.nodes.find((n) => n.nodeId === 'shanghai-pudong')!.total, 0);
  assert.equal(feed.data.designatorsLoaded, 1);

  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AirPanel } = await import('@/components/live/air-panel');
  const html = renderToStaticMarkup(React.createElement(AirPanel, { reading: feed }));
  for (const hidden of ['QQQ5501', 'N123AB', 'SSS33', '000a03', '&lt;b&gt;']) assert.ok(!html.includes(hidden), `unmatched identifier rendered: ${hidden}`);
  assert.ok(html.includes('ZZZ1234') && html.includes('Callsign begins with ZZZ, the designator the FAA lists for [SAMPLE] Air Freight'));
  const withoutCaveat = html.replace(/\s+/g, ' ').replace('Cargo is not shown and cannot be', '');
  assert.ok(!/carrying|cargo of|laden/i.test(withoutCaveat), 'no cargo claim');
  // The operator name appears only in matched rows.
  const nameCount = html.split('[SAMPLE] Air Freight').length - 1;
  const matchedRows = feed.data.nodes.reduce((n, node) => n + node.matched.length, 0);
  assert.equal(nameCount, matchedRows, 'operator name only beside matched flights');
  assert.ok(html.includes('No signal in this sample') && html.includes('not an empty sky'), 'empty hub');
  // No operators loaded: the count-only line.
  const anonymous = await buildAirReading(AIR_NODES.map((n) => air.parseStates({ time: t, states: null }, n)), []);
  const anonHtml = renderToStaticMarkup(React.createElement(AirPanel, { reading: anonymous }));
  assert.ok(anonHtml.includes('No operator designators are loaded yet'));
  const off = renderToStaticMarkup(React.createElement(AirPanel, { reading: { status: 'not-configured', source: 'opensky', envVar: 'OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET' } }));
  assert.ok(off.includes('Not switched on yet') && !off.includes('Air hub'));
  console.log('PASS privacy and render: unmatched aircraft only counted, operator inferred only from a loaded designator, no cargo claim, empty and off states');

  // --- 8. Operator records must cite FAA Order JO 7340.2 ------------------------
  const { parseCarrier } = await import('@/lib/carriers/sources/local-files');
  const operator = {
    id: 'example-air', name: '[SAMPLE] Example Air', kind: 'air-operator', relationship: 'listed',
    sourceLabel: 'FAA Order JO 7340.2N, Chapter 3', asOf: '2026-11-01', retrieved: '2026-11-02',
    sources: [{ url: 'https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/', publisher: 'Federal Aviation Administration' }],
    termsChecked: { on: '2026-11-02', note: 'US government work' }, designators: ['ZZZ', 'zz', 'ZZZ'],
  };
  const warnings: string[] = [];
  assert.deepEqual(parseCarrier(operator, 'op.json', warnings, '2026-11-28')?.designators, ['ZZZ']);
  assert.equal(parseCarrier({ ...operator, sourceLabel: 'Airline codes' }, 'op.json', warnings, '2026-11-28'), null, 'no edition named');
  assert.equal(parseCarrier({ ...operator, sources: [{ url: 'https://en.wikipedia.org/wiki/x', publisher: 'W' }] }, 'op.json', warnings, '2026-11-28'), null, 'not faa.gov');
  console.log('PASS operator records: refused unless they cite FAA Order JO 7340.2 on faa.gov');

  // --- 9. The NEXT_PUBLIC_ guard ------------------------------------------------
  const { assertNoPublicLiveSecrets } = await import('@/config/input-ledger');
  assert.doesNotThrow(() => assertNoPublicLiveSecrets());
  for (const name of ['NEXT_PUBLIC_AISSTREAM_API_KEY', 'NEXT_PUBLIC_OPENSKY_CLIENT_SECRET', 'NEXT_PUBLIC_OPENSKY_CLIENT_ID', 'NEXT_PUBLIC_FINNHUB_API_KEY']) {
    process.env[name] = 'x';
    assert.throws(() => assertNoPublicLiveSecrets(), new RegExp(name));
    delete process.env[name];
  }
  console.log('PASS build guard: refuses a NEXT_PUBLIC_ AIS, Finnhub or OpenSky credential');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
