/**
 * Builds src/components/chokepoint-land.ts: the coastline for each of the ten
 * chokepoint ship panels, from Natural Earth's 1:10m land layer.
 *
 *   npx tsx scripts/build-chokepoint-land.ts <path to ne_10m_land.geojson>
 *
 * WHY A SECOND LAND FILE
 *
 * The locator maps use 1:50m land simplified for a world-wide frame (about a
 * quarter of a degree per unit). A sampling box is about one degree across, so
 * at that detail a whole strait is a few units wide: a blob. The panels need
 * the 1:10m layer, clipped and simplified per place.
 *
 * Natural Earth is in the public domain and free for any use, so it fits the
 * "public domain" line in Rule 3 (https://www.naturalearthdata.com/about/terms-of-use/),
 * the same basis as world-land.ts. The GeoJSON (about 10 MB) is NOT committed:
 * get it from https://github.com/nvkelso/natural-earth-vector
 * (geojson/ne_10m_land.geojson), run this, and commit only the generated file.
 *
 * What it does, per chokepoint: takes the panel window from
 * src/lib/live/panel-geo.ts (the same module the components plot ships with),
 * projects every ring that touches it, clips it to the window plus a margin,
 * simplifies it to about a third of a unit, and drops specks too small to see.
 * Each place is one SVG path drawn with the even-odd rule.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CHOKEPOINTS } from '@/lib/live/nodes';
import { PANEL_HEIGHT, PANEL_WIDTH, panelWindows, project, type PanelWindow } from '@/lib/live/panel-geo';

type Pt = [number, number];

const MARGIN = 8; // user units outside the frame, so clipped edges never show
const TOLERANCE = 0.33; // Douglas-Peucker tolerance, user units (a panel is 320 wide)
const MIN_AREA = 0.6; // square user units; smaller islands are left out
const OUT = path.resolve(__dirname, '../src/components/chokepoint-land.ts');

function clipEdge(poly: Pt[], inside: (p: Pt) => boolean, cross: (a: Pt, b: Pt) => Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) {
      out.push(cross(prev, cur));
    }
  }
  return out;
}

function clip(ring: Pt[]): Pt[] {
  const [x0, y0, x1, y1] = [-MARGIN, -MARGIN, PANEL_WIDTH + MARGIN, PANEL_HEIGHT + MARGIN];
  const atX = (x: number) => (a: Pt, b: Pt): Pt => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const atY = (y: number) => (a: Pt, b: Pt): Pt => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
  let out = ring;
  out = clipEdge(out, (p) => p[0] >= x0, atX(x0));
  if (out.length) out = clipEdge(out, (p) => p[0] <= x1, atX(x1));
  if (out.length) out = clipEdge(out, (p) => p[1] >= y0, atY(y0));
  if (out.length) out = clipEdge(out, (p) => p[1] <= y1, atY(y1));
  return out;
}

function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let worst = 0;
    let at = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i += 1) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area(ring: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** A ring's bounding box in degrees, to skip rings nowhere near a window. */
function bounds(ring: number[][]): [number, number, number, number] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of ring) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

function landFor(window: PanelWindow, rings: { ring: number[][]; bbox: [number, number, number, number] }[]): { d: string; kept: number } {
  const pad = 0.5; // degrees
  const parts: string[] = [];
  let kept = 0;
  for (const { ring, bbox } of rings) {
    const [w, s, e, n] = bbox;
    if (e < window.west - pad || w > window.east + pad || n < window.south - pad || s > window.north + pad) continue;
    const lonLat = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
    const projected = lonLat.map(([lon, lat]) => project(window, lat, lon));
    const clipped = clip(projected);
    if (clipped.length < 3) continue;
    // A closed ring has no chord to measure against, so split it at the point
    // farthest from the start and simplify the two halves as open lines.
    let far = 1;
    for (let i = 2; i < clipped.length; i += 1) {
      if (Math.hypot(clipped[i][0] - clipped[0][0], clipped[i][1] - clipped[0][1]) >
        Math.hypot(clipped[far][0] - clipped[0][0], clipped[far][1] - clipped[0][1])) far = i;
    }
    const first = simplify(clipped.slice(0, far + 1), TOLERANCE);
    const second = simplify([...clipped.slice(far), clipped[0]], TOLERANCE);
    const simple = [...first, ...second.slice(1, -1)];
    if (simple.length < 3 || area(simple) < MIN_AREA) continue;
    kept += 1;
    parts.push(`M${simple.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`);
  }
  return { d: parts.join(''), kept };
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npx tsx scripts/build-chokepoint-land.ts <ne_10m_land.geojson>');
  const raw = readFileSync(file);
  const sha = createHash('sha256').update(raw).digest('hex');
  const geo = JSON.parse(raw.toString('utf8')) as { features: { geometry: { type: string; coordinates: unknown } }[] };

  const rings: { ring: number[][]; bbox: [number, number, number, number] }[] = [];
  for (const feature of geo.features) {
    const { type, coordinates } = feature.geometry;
    const polygons = (type === 'Polygon' ? [coordinates] : coordinates) as number[][][][];
    for (const polygon of polygons) for (const ring of polygon) rings.push({ ring, bbox: bounds(ring) });
  }

  const entries: string[] = [];
  for (const window of panelWindows(CHOKEPOINTS)) {
    const { d, kept } = landFor(window, rings);
    entries.push(`  '${window.nodeId}':\n    '${d}',`);
    console.log(`${window.nodeId}: ${kept} rings, ${(d.length / 1024).toFixed(1)} KB`);
  }

  const out = `/**
 * Land for the chokepoint ship panels, one SVG path per place (even-odd fill).
 * GENERATED by scripts/build-chokepoint-land.ts from Natural Earth's 1:10m
 * land layer (ne_10m_land.geojson, sha256 ${sha.slice(0, 16)}…), which is in
 * the public domain (https://www.naturalearthdata.com/about/terms-of-use/).
 * Do not edit by hand: the coordinates are already in each panel's projection
 * (src/lib/live/panel-geo.ts), so a change to a sampling box or to the panel
 * geometry means running the script again.
 *
 * At this detail a canal is narrower than the data: the Suez and Panama canals
 * are drawn as continuous land, and ships in them plot over it. That is the
 * source's resolution, not a position error.
 */
export const CHOKEPOINT_LAND: Readonly<Record<string, string>> = {
${entries.join('\n')}
};
`;
  writeFileSync(OUT, out);
  console.log(`${(Buffer.byteLength(out) / 1024).toFixed(1)} KB written to src/components/chokepoint-land.ts`);
}

main();
