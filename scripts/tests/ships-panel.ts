/**
 * Regression tests for the ship panels on /monitor (Vessels Part 2):
 * src/lib/live/panel-geo.ts, src/lib/live/vessel-filter.ts and the panels in
 * src/components/live/ships-panel.tsx, rendered with react-dom/server against
 * the fixtures. Run by `npm run test:regressions`.
 */

import assert from 'node:assert/strict';

async function main() {
  Object.assign(process.env, { NODE_ENV: 'development', CONTENT_SOURCE: 'fixtures' });
  delete process.env.VESSEL_STORE;

  const { CHOKEPOINTS } = await import('@/lib/live/nodes');
  const geo = await import('@/lib/live/panel-geo');
  const { filterVessels, toShipsData, NO_FILTERS } = await import('@/lib/live/vessel-filter');
  const vessels = await import('@/lib/live/vessels');

  // --- 1. panel-geo ----------------------------------------------------------
  const windows = geo.panelWindows(CHOKEPOINTS);
  assert.equal(windows.length, 10, 'ten chokepoints with boxes');
  for (const window of windows) {
    const [[south, west], [north, east]] = window.box;
    // Every corner and the centre of the box land inside the viewBox.
    for (const [lat, lon] of [[south, west], [south, east], [north, west], [north, east], [(south + north) / 2, (west + east) / 2]]) {
      const [x, y] = geo.project(window, lat, lon);
      assert.ok(x > 0 && x < geo.PANEL_WIDTH && y > 0 && y < geo.PANEL_HEIGHT, `${window.nodeId} ${lat},${lon} -> ${x},${y}`);
    }
    // The window keeps the panel's aspect, in true (cos-latitude) units.
    const ratio = (window.north - window.south) / ((window.east - window.west) * window.cosLat);
    assert.ok(Math.abs(ratio - geo.PANEL_ASPECT) < 1e-9, `${window.nodeId} aspect`);
    // Round trip.
    const [x, y] = geo.project(window, north - 0.01, west + 0.01);
    const [lat, lon] = geo.unproject(window, x, y);
    assert.ok(Math.abs(lat - (north - 0.01)) < 1e-9 && Math.abs(lon - (west + 0.01)) < 1e-9, `${window.nodeId} round trip`);
  }
  // cos-latitude: at Dover (51° N) one degree east is cos(51°) of one degree north on screen.
  const dover = windows.find((w) => w.nodeId === 'dover')!;
  const [ax, ay] = geo.project(dover, 51, 1.5);
  const [bx] = geo.project(dover, 51, 2.5);
  const [, cy] = geo.project(dover, 50, 1.5);
  assert.ok(Math.abs((bx - ax) / (cy - ay) - Math.cos((dover.box[0][0] + dover.box[1][0]) / 2 * Math.PI / 180)) < 1e-9);
  // Known coordinate: a box's north-west corner sits WINDOW_PADDING-ish inside the top-left.
  const suez = windows.find((w) => w.nodeId === 'suez')!;
  const rect = geo.boxRect(suez);
  assert.ok(rect.x > 0 && rect.y > 0 && rect.x + rect.width < geo.PANEL_WIDTH && rect.y + rect.height < geo.PANEL_HEIGHT);
  console.log('PASS panel-geo: every box inside its viewBox, aspect kept, cos-latitude scaling, round trip');

  // --- 2. Land file ----------------------------------------------------------
  const { CHOKEPOINT_LAND } = await import('@/components/chokepoint-land');
  for (const window of windows) assert.ok((CHOKEPOINT_LAND[window.nodeId] ?? '').startsWith('M'), `land for ${window.nodeId}`);
  console.log('PASS generated coastline present for all ten chokepoints');

  // --- 3. filterVessels ------------------------------------------------------
  const record = (mmsi: string, nodeId: string, patch: Partial<import('@/lib/live/vessels').VesselRecord>) => {
    const base = {
      mmsi, lat: 30.6, lon: 32.4, sog: 10, cog: 90, heading: 90, seenAt: '2026-11-27T12:00:00.000Z', nodeId,
      name: null, imo: null, callsign: null, shipType: null, staticSeenAt: null, flag: null, typeSource: 'unknown' as const, carrierIds: [] as string[],
      ...patch,
    };
    return { ...base, category: vessels.shipCategory(base.shipType) };
  };
  const box = { suez: CHOKEPOINTS.find((n) => n.id === 'suez')!.box! };
  const data = toShipsData(
    [
      record('999000001', 'suez', { name: 'ALPHA CARGO', shipType: 70, typeSource: 'this-sample', flag: '[SAMPLE] Aland' }),
      record('999000002', 'suez', { name: 'BRAVO (TANKER).*', shipType: 80, typeSource: 'registry', staticSeenAt: '2026-11-01T00:00:00.000Z', sog: 0.2 }),
      record('999000003', 'suez', { name: '<script>alert(1)</script>', shipType: 60, typeSource: 'this-sample', flag: '[SAMPLE] Borduria' }),
      record('999000004', 'suez', { sog: null }),
      record('999000005', 'suez', { name: 'GREY HULL', shipType: 35, typeSource: 'this-sample' }),
      record('999000006', 'nowhere', { name: 'OFF MAP' }),
    ],
    box,
  );
  const ships = data.byNode.suez;
  assert.equal(ships.length, 5, 'a record for a node with no panel is dropped');
  assert.equal(data.byNode.nowhere, undefined);
  assert.deepEqual(data.flags, ['[SAMPLE] Aland', '[SAMPLE] Borduria']);
  const ids = (list: { m: string }[]) => list.map((s) => s.m).sort();
  assert.deepEqual(ids(filterVessels(ships, NO_FILTERS, data.flags)), ids(ships));
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, category: 'tanker' }, data.flags)), ['999000002']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, category: 'unknown' }, data.flags)), ['999000004']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, underwayOnly: true }, data.flags)), ['999000001', '999000003', '999000005']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, flag: '[SAMPLE] Borduria' }, data.flags)), ['999000003']);
  assert.deepEqual(filterVessels(ships, { ...NO_FILTERS, flag: 'Nowhere' }, data.flags), [], 'unknown flag matches nothing');
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, search: 'alpha' }, data.flags)), ['999000001']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, search: '000004' }, data.flags)), ['999000004']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, search: '(tanker).*' }, data.flags)), ['999000002'], 'regex characters are plain text');
  assert.deepEqual(filterVessels(ships, { ...NO_FILTERS, search: '.*' }, data.flags).map((s) => s.m), ['999000002']);
  assert.deepEqual(ids(filterVessels(ships, { ...NO_FILTERS, search: '<script>' }, data.flags)), ['999000003']);
  assert.deepEqual(ids(filterVessels(ships, { category: 'cargo', underwayOnly: true, flag: '[SAMPLE] Aland', search: 'ALP', carrier: 'all' }, data.flags)), ['999000001']);
  assert.deepEqual(filterVessels(ships, { category: 'cargo', underwayOnly: false, flag: '[SAMPLE] Borduria', search: '', carrier: 'all' }, data.flags), [], 'empty result');
  assert.deepEqual(filterVessels(ships, { ...NO_FILTERS, search: 'grey' }, data.flags), [], 'a withheld name cannot be searched');
  const grey = ships.find((s) => s.m === '999000005')!;
  assert.equal(grey.n, undefined);
  assert.equal(grey.w, 1, 'military name withheld');
  const { dayToDate, heardAt } = await import('@/lib/live/vessel-filter');
  assert.equal(dayToDate(ships.find((s) => s.m === '999000002')!.r!), '2026-11-01');
  assert.equal(heardAt(data, ships[0]), '2026-11-27T12:00:00.000Z', 'heard time round-trips');
  assert.equal(ships[0].u, 1, 'under way first');
  console.log('PASS filterVessels: each filter alone and combined, empty result, plain-text search, withheld names');

  // --- 4. Server render against the fixtures ---------------------------------
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShipsPanel } = await import('@/components/live/ships-panel');
  const { SHAPE_KEY } = await import('@/components/live/ship-shapes');
  const { getVesselFeed } = await import('@/lib/live');
  const { listDisruptions } = await import('@/lib/disruptions');

  const feed = await getVesselFeed();
  assert.equal(feed.status, 'ok');
  const open = (await listDisruptions()).filter((d) => d.status !== 'resolved');
  const register: Record<string, { id: string; title: string; status: (typeof open)[number]['status'] }[]> = {};
  for (const d of open) for (const place of d.places) (register[place] ??= []).push({ id: d.id, title: d.title, status: d.status });
  const html = renderToStaticMarkup(React.createElement(ShipsPanel, { reading: feed, register }));

  // No company name anywhere: every entity the register names, fixtures included.
  const companies = new Set(open.flatMap((d) => d.exposures.map((e) => e.entity.name)));
  assert.ok(companies.size > 0, 'the fixture register names companies to check against');
  for (const name of companies) assert.ok(!html.includes(name), `company name in output: ${name}`);
  // No register status colour on any ship: status classes appear only inside StatusBadge.
  const marks = html.match(/<(circle|rect|polygon|path)[^>]*>/g) ?? [];
  assert.ok(marks.length > 50);
  for (const mark of marks) assert.ok(!/status-/.test(mark), `status class on a drawn mark: ${mark}`);
  // Every shape in the key has its words.
  for (const { label } of SHAPE_KEY) assert.ok(html.includes(label), `key label missing: ${label}`);
  // An empty box says so.
  assert.ok(html.includes('No signal in this sample'), 'Cape of Good Hope fixture is empty');
  // Names are text, never markup.
  assert.ok(!html.includes('<script>'), 'a ship name rendered as markup');
  assert.ok(html.includes('&lt;script&gt;'), 'the hostile name is still shown, escaped');
  // The required copy.
  for (const phrase of ['reported by the ship', 'not that no ship was there', 'under-represented', 'says nothing about what it is', 'Flag (from MMSI)', 'Type known for', 'traffic, not', 'No open register entry names this place']) {
    assert.ok(html.replace(/\s+/g, ' ').includes(phrase), `copy missing: ${phrase}`);
  }
  assert.ok(!/carrying(?! )/.test(html) || html.includes('what it is carrying'), 'only the caveat uses "carrying"');
  console.log('PASS server render: no company names, no status colour on ships, key complete, empty box, escaped names, required copy');

  // Unavailable and not-configured: the reason, and no ships.
  const unavailable = renderToStaticMarkup(
    React.createElement(ShipsPanel, { reading: { status: 'unavailable', source: 'ais', reason: 'AISStream closed the connection before the sample finished.' }, register }),
  );
  assert.ok(unavailable.includes('closed the connection'));
  assert.ok(!unavailable.includes('Filter ships') && !/<circle/.test(unavailable), 'no ships when unavailable');
  const off = renderToStaticMarkup(React.createElement(ShipsPanel, { reading: { status: 'not-configured', source: 'ais', envVar: 'AISSTREAM_API_KEY' }, register }));
  assert.ok(off.includes('Not switched on yet') && !/<circle/.test(off));
  console.log('PASS unavailable and not-configured readings render their state and no ships');

  // --- 5. Payload budget at the 2,000-vessel cap -----------------------------
  const big = Array.from({ length: vessels.VESSELS_TOTAL_CAP }, (_, i) => {
    const node = CHOKEPOINTS[i % 10];
    const [[s, w], [n, e]] = node.box!;
    return record(String(200_000_000 + i * 97), node.id, {
      lat: s + ((i * 7) % 100) / 100 * (n - s),
      lon: w + ((i * 13) % 100) / 100 * (e - w),
      sog: 12.3,
      cog: 271.4,
      name: 'X'.repeat(20), // AIS names are at most 20 characters
      shipType: 80,
      typeSource: 'registry',
      staticSeenAt: '2026-11-01T00:00:00.000Z',
      flag: `[SAMPLE] Country with a long official name ${i % 120}`,
    });
  });
  const boxes = Object.fromEntries(CHOKEPOINTS.map((n) => [n.id, n.box!]));
  const bytes = Buffer.byteLength(JSON.stringify(toShipsData(big, boxes)));
  assert.ok(bytes < 250 * 1024, `island payload ${bytes} bytes at the cap`);
  console.log(`PASS island payload at the 2,000-vessel cap, worst case: ${(bytes / 1024).toFixed(1)} KB (budget 250 KB)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
