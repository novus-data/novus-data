/**
 * Regression tests for carrier fleet lists (Vessels Part 3A):
 * src/lib/carriers/, the carrier filter in src/lib/live/vessel-filter.ts, the
 * carrier copy and transparency table in the ship panels, and
 * scripts/import-fleet.ts. Run by `npm run test:regressions`.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function main() {
  Object.assign(process.env, { NODE_ENV: 'development', CONTENT_SOURCE: 'fixtures' });
  delete process.env.VESSEL_STORE;

  const types = await import('@/lib/carriers/types');
  const { parseCarrier, readCarriers } = await import('@/lib/carriers/sources/local-files');
  const { matchCarriers, buildImoIndex } = await import('@/lib/carriers/match');

  // --- 1. isValidImo -----------------------------------------------------------
  assert.equal(types.isValidImo(9074729), true, 'worked example: 9×7+0×6+7×5+4×4+7×3+2×2 = 139');
  assert.equal(types.isValidImo('9074729'), true);
  assert.equal(types.isValidImo(9074720), false, 'wrong check digit');
  for (const bad of [0, 907472, 90747290, '907472A', 'abc', null, undefined, 9074729.5, -9074729, '']) {
    assert.equal(types.isValidImo(bad), false, `rejects ${String(bad)}`);
  }
  assert.equal(types.isValidImo(1_000_007), true);
  assert.equal(types.isValidImo(1_000_019), true);
  assert.equal(types.isValidImo(1_000_021), true);
  console.log('PASS isValidImo: worked pass and fail, wrong length, non-numeric, zero');

  // --- 2. Loader ---------------------------------------------------------------
  const today = '2026-11-28';
  const good = {
    id: 'test-lines',
    name: '[SAMPLE] Test Lines',
    kind: 'shipping-line',
    relationship: 'operated',
    sourceLabel: '[SAMPLE] Fleet',
    asOf: '2026-11-01',
    retrieved: '2026-11-02',
    sources: [{ url: 'https://example.invalid/fleet', publisher: '[SAMPLE] Test Lines' }],
    termsChecked: { on: '2026-11-02', note: '[SAMPLE] terms read' },
    imo: [1_000_007, 1_000_007, 1_000_000, 1_000_019],
  };
  const load = (patch: Record<string, unknown>) => {
    const warnings: string[] = [];
    return { record: parseCarrier({ ...good, ...patch }, 'x.json', warnings, today), warnings };
  };
  const ok = load({});
  assert.deepEqual(ok.record?.imo, [1_000_007, 1_000_019], 'bad IMO dropped, duplicate collapsed, record stands');
  assert.match(ok.warnings.join(' '), /Corrected x\.json: dropped 1 IMO/);
  assert.match(ok.warnings.join(' '), /collapsed 1 duplicate/);
  for (const [why, patch] of [
    ['missing source', { sources: [] }],
    ['non-http URL', { sources: [{ url: 'ftp://example.invalid/x', publisher: 'P' }] }],
    ['javascript URL', { sources: [{ url: 'javascript:alert(1)', publisher: 'P' }] }],
    ['future asOf', { asOf: '2027-01-01' }],
    ['impossible date', { asOf: '2026-02-30' }],
    ['missing termsChecked', { termsChecked: undefined }],
    ['termsChecked without note', { termsChecked: { on: '2026-11-02' } }],
    ['missing relationship', { relationship: undefined }],
    ['unknown relationship', { relationship: 'partner' }],
    ['no valid IMO at all', { imo: [1_000_000] }],
    ['bad id', { id: 'Not Safe' }],
  ] as const) {
    const { record, warnings } = load(patch as Record<string, unknown>);
    assert.equal(record, null, why);
    assert.match(warnings.join(" "), /Refused x\.json/, `${why}: warning names the file`);
  }
  // From disk: a duplicate id is refused; the same IMO in two carriers is allowed.
  const dir = await mkdtemp(path.join(os.tmpdir(), 'novus-carriers-'));
  process.env.NOVUS_CARRIERS_DIR = dir;
  await writeFile(path.join(dir, 'a.json'), JSON.stringify(good));
  await writeFile(path.join(dir, 'b.json'), JSON.stringify({ ...good, id: 'other-owners', relationship: 'owned', imo: [1_000_019] }));
  await writeFile(path.join(dir, 'c.json'), JSON.stringify(good));
  await writeFile(path.join(dir, 'd.json'), '{ not json');
  const read = await readCarriers(today);
  assert.deepEqual(read.carriers.map((c) => c.id), ['test-lines', 'other-owners']);
  assert.match(read.warnings.join(' '), /Refused c\.json: the id "test-lines" is already used/);
  assert.match(read.warnings.join(' '), /Refused d\.json: not valid JSON/);
  // [SAMPLE] records never load in production.
  Object.assign(process.env, { NODE_ENV: 'production' });
  const prod = await readCarriers(today);
  assert.equal(prod.carriers.length, 0, '[SAMPLE] carriers refused in production');
  Object.assign(process.env, { NODE_ENV: 'development' });
  console.log('PASS loader: every required field enforced, bad IMO dropped with the record kept, duplicates, same IMO in two lists, [SAMPLE] refused in production');

  // --- 3. Matching -------------------------------------------------------------
  const now = new Date('2026-11-28T00:00:00Z');
  const index = buildImoIndex(read.carriers);
  assert.deepEqual(matchCarriers(1_000_007, index, now).map((m) => m.carrierId), ['test-lines']);
  assert.deepEqual(matchCarriers(1_000_019, index, now).map((m) => m.carrierId).sort(), ['other-owners', 'test-lines'], 'two matches kept');
  assert.deepEqual(matchCarriers(1_000_021, index, now), [], 'valid IMO in no list');
  assert.deepEqual(matchCarriers(1_000_000, index, now), [], 'invalid IMO matches nothing');
  assert.deepEqual(matchCarriers(0, index, now), [], 'zero matches nothing');
  assert.deepEqual(matchCarriers(null, read.carriers, now), []);
  assert.equal(matchCarriers(1_000_007, index, new Date('2027-06-01T00:00:00Z'))[0].stale, true);
  assert.equal(matchCarriers(1_000_007, index, now)[0].stale, false);
  console.log('PASS matchCarriers: by IMO only, two matches kept, invalid and zero match nothing, staleness at build time');

  // --- 4. The feed, on fixtures: a ship NAMED like a carrier gets nothing -------
  delete process.env.NOVUS_CARRIERS_DIR;
  const { getVesselFeed } = await import('@/lib/live');
  const feed = await getVesselFeed();
  assert.equal(feed.status, 'ok');
  if (feed.status !== 'ok') throw new Error('unreachable');
  const byMmsi = new Map(feed.data.vessels.map((v) => [v.mmsi, v]));
  assert.deepEqual(byMmsi.get('999100001')?.carrierIds, ['sample-example-lines']);
  assert.deepEqual([...(byMmsi.get('999100004')?.carrierIds ?? [])].sort(), ['sample-example-lines', 'sample-old-owners']);
  const lookalike = byMmsi.get('999100007')!;
  assert.match(lookalike.name ?? '', /EXAMPLE LINES/i, 'the lookalike is named like the carrier');
  assert.deepEqual(lookalike.carrierIds, [], 'a name is never evidence');
  assert.ok(feed.data.vessels.every((v) => Array.isArray(v.carrierIds)));
  assert.equal(feed.data.carrierMatched, 2);
  assert.equal(feed.data.carriers.length, 2);
  assert.ok(feed.data.carriers.every((c) => !('imo' in c)), 'summaries carry no IMO list');
  console.log('PASS feed: carrierIds on every record, IMO matches found, a carrier-named ship with an unlisted IMO matches nothing');

  // --- 5. filterVessels with the carrier filter ---------------------------------
  const { toShipsData, filterVessels, NO_FILTERS } = await import('@/lib/live/vessel-filter');
  const { CHOKEPOINTS } = await import('@/lib/live/nodes');
  const boxes = Object.fromEntries(CHOKEPOINTS.map((n) => [n.id, n.box!]));
  const ships = toShipsData(feed.data.vessels, boxes, feed.data.carriers);
  assert.deepEqual(ships.carriers.map((c) => c.id), ['sample-example-lines', 'sample-old-owners']);
  const all = Object.values(ships.byNode).flat();
  const ids = (list: { m: string }[]) => list.map((s) => s.m).sort();
  assert.deepEqual(ids(filterVessels(all, { ...NO_FILTERS, carrier: 'sample-example-lines' }, ships.flags, ships.carriers)), ['999100001', '999100004']);
  assert.deepEqual(ids(filterVessels(all, { ...NO_FILTERS, carrier: 'sample-old-owners' }, ships.flags, ships.carriers)), ['999100004']);
  assert.equal(filterVessels(all, { ...NO_FILTERS, carrier: 'none' }, ships.flags, ships.carriers).length, all.length - 2);
  assert.deepEqual(ids(filterVessels(all, { ...NO_FILTERS, carrier: 'sample-example-lines', category: 'tanker' }, ships.flags, ships.carriers)), ['999100004']);
  assert.deepEqual(filterVessels(all, { ...NO_FILTERS, carrier: 'sample-example-lines', search: '.*' }, ships.flags, ships.carriers), [], 'regex characters stay plain text');
  assert.deepEqual(filterVessels(all, { ...NO_FILTERS, carrier: 'nobody' }, ships.flags, ships.carriers), []);
  console.log('PASS filterVessels: carrier alone, combined, "no match" option, unknown carrier, plain-text search');

  // --- 6. Server render ---------------------------------------------------------
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShipsPanel } = await import('@/components/live/ships-panel');
  const html = renderToStaticMarkup(React.createElement(ShipsPanel, { reading: feed, register: {} }));
  const flat = html.replace(/\s+/g, ' ');
  // A carrier name appears in the transparency table and the filter only, never in a card without a match.
  for (const card of ['suez', 'gibraltar', 'hormuz', 'dover', 'singapore-strait']) {
    const start = html.indexOf(`id="ships-${card}"`);
    const end = html.indexOf('</article>', start);
    const cardHtml = html.slice(start, end);
    const matchedHere = feed.data.vessels.some((v) => v.nodeId === card && v.carrierIds.length > 0);
    if (!matchedHere) for (const c of feed.data.carriers) assert.ok(!cardHtml.includes(c.name), `${c.name} in the ${card} card with no match`);
  }
  // Carrier names never sit beside a status colour, a cargo claim or "carrying".
  for (const c of feed.data.carriers) {
    for (let at = html.indexOf(c.name); at !== -1; at = html.indexOf(c.name, at + 1)) {
      const around = html.slice(Math.max(0, at - 300), at + 300);
      assert.ok(!/status-/.test(around), `status colour near ${c.name}`);
      assert.ok(!/carries |cargo of|laden/i.test(around.replace(/a line carries other firms/g, '')), `cargo claim near ${c.name}`);
    }
  }
  // "Carrying" appears only inside the two caveats that deny it.
  const withoutCaveats = flat.replace('says nothing about what it is carrying', '').replace('does not show who is carrying what', '');
  assert.ok(!/carrying/i.test(withoutCaveats), 'no "carrying" claim');
  for (const phrase of [
    'appears in that carrier’s own published list',
    'does not show who is carrying what',
    'can be wrong or falsified',
    'may belong to any carrier',
    'each shows its own date',
    'not a statement that the carrier is affected',
    'matched to a listed fleet; the rest are unmatched, not unaffiliated',
    'Had not been refreshed when this page was built',
    'Carrier (from published fleet lists)',
    'No match in the lists we hold',
  ]) {
    assert.ok(flat.includes(phrase), `copy missing: ${phrase}`);
  }
  assert.ok(html.includes('rel="noopener noreferrer"'));
  // No carriers loaded: the empty state, and no carrier control.
  const empty = renderToStaticMarkup(
    React.createElement(ShipsPanel, { reading: { ...feed, data: { ...feed.data, carriers: [], carrierMatched: 0, vessels: feed.data.vessels.map((v) => ({ ...v, carrierIds: [] })) } }, register: {} }),
  );
  assert.ok(empty.includes('Novus has not loaded any carrier fleet lists yet'));
  assert.ok(empty.includes('No heard ship matched a fleet list we hold'));
  assert.ok(!empty.includes('Carrier (from published fleet lists)'), 'no carrier control when nothing matched');
  console.log('PASS render: carrier names only where matched and in the lists table, no status colour or cargo claim, required copy, stale note, empty state');

  // --- 7. Payload with carriers at the cap ---------------------------------------
  const vessels = await import('@/lib/live/vessels');
  const big = Array.from({ length: vessels.VESSELS_TOTAL_CAP }, (_, i) => {
    const node = CHOKEPOINTS[i % 10];
    const [[s, w], [n, e]] = node.box!;
    return {
      mmsi: String(200_000_000 + i * 97), lat: s + ((i * 7) % 100) / 100 * (n - s), lon: w + ((i * 13) % 100) / 100 * (e - w),
      sog: 12.3, cog: 271.4, heading: 270, seenAt: '2026-11-27T12:00:00.000Z', nodeId: node.id,
      name: 'X'.repeat(20), imo: 1_000_007, callsign: null, shipType: 80, staticSeenAt: '2026-11-01T00:00:00.000Z',
      category: 'tanker' as const, flag: `[SAMPLE] Country with a long official name ${i % 120}`, typeSource: 'registry' as const,
      carrierIds: ['sample-example-lines'],
    };
  });
  const bytes = Buffer.byteLength(JSON.stringify(toShipsData(big, boxes, feed.data.carriers)));
  assert.ok(bytes < 250 * 1024, `island payload ${bytes} bytes`);
  console.log(`PASS island payload with a carrier on every ship at the 2,000-vessel cap, worst case: ${(bytes / 1024).toFixed(1)} KB (budget 250 KB)`);

  // --- 8. import-fleet -----------------------------------------------------------
  const script = path.join(process.cwd(), 'scripts', 'import-fleet.ts');
  const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const run = (args: string[]) => {
    try {
      return { code: 0, out: execFileSync(tsx, [script, ...args], { env: { ...process.env, NOVUS_CARRIERS_DIR: dir, CONTENT_SOURCE: '' }, encoding: 'utf8', stdio: 'pipe' }) };
    } catch (error) {
      const e = error as { status: number; stdout: string; stderr: string };
      return { code: e.status, out: `${e.stdout}${e.stderr}` };
    }
  };
  const csv = path.join(dir, 'fleet.csv');
  await writeFile(csv, 'Name,IMO\n"[SAMPLE] A",1000007\n[SAMPLE] B,1000019\n[SAMPLE] C,1000019\n[SAMPLE] D,1000000\n[SAMPLE] E,12345\n');
  const flags = [
    '--id', 'imported-lines', '--name', '[SAMPLE] Imported Lines', '--relationship', 'owned',
    '--source-url', 'https://example.invalid/fleet', '--publisher', '[SAMPLE] Imported Lines',
    '--retrieved', '2026-11-20', '--as-of', '2026-11-19', '--source-label', '[SAMPLE] Fleet list',
    '--terms-note', '[SAMPLE] read',
  ];
  const refused = run([csv, ...flags.slice(0, -2)]);
  assert.notEqual(refused.code, 0);
  assert.match(refused.out, /missing --terms-note/);
  assert.match(run(flags).out, /no input file/);
  const done = run([csv, ...flags]);
  assert.equal(done.code, 0, done.out);
  assert.match(done.out, /Rows: 5/);
  assert.match(done.out, /Valid IMO numbers: 3/);
  assert.match(done.out, /Duplicates collapsed: 1/);
  assert.match(done.out, /Invalid .*: 2/);
  assert.match(done.out, /invalid: "1000000"/);
  const written = JSON.parse(await readFile(path.join(dir, 'imported-lines.json'), 'utf8'));
  assert.deepEqual(written.imo, [1_000_007, 1_000_019]);
  assert.match(run([csv, ...flags]).out, /already exists. Pass --replace/);
  assert.equal(run([csv, ...flags, '--replace']).code, 0);
  console.log('PASS import-fleet: refuses without every flag, counts rows, valid, invalid and duplicates, never overwrites without --replace');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
