/**
 * Builds src/components/world-land.ts, the land drawn on the two locator maps,
 * from Natural Earth's 1:50m land layer.
 *
 *   npx tsx scripts/build-map-land.ts <path to ne_50m_land.geojson>
 *
 * Natural Earth is in the public domain and free for any use, so it fits the
 * "public domain" line in Rule 3 (https://www.naturalearthdata.com/about/terms-of-use/).
 * The GeoJSON is not committed: get it from
 * https://github.com/nvkelso/natural-earth-vector (geojson/ne_50m_land.geojson),
 * run this, and commit only the generated file.
 *
 * What it does: projects every ring with the maps' own projection, clips it to
 * the visible window (plus a margin), simplifies it to about a third of a pixel,
 * and drops islands too small to see. The map draws the result as one path with
 * the even-odd rule, so lakes and inland seas (the Caspian) are holes in the land.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { HEIGHT, WIDTH, project } from '@/components/chokepoint-map-base';

type Pt = [number, number];

const MARGIN = 24; // user units outside the frame, so clipping edges never show
const TOLERANCE = 0.7; // Douglas-Peucker tolerance, in user units
const MIN_AREA = 6; // square user units; smaller islands are left out

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
  const [x0, y0, x1, y1] = [-MARGIN, -MARGIN, WIDTH + MARGIN, HEIGHT + MARGIN];
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

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npx tsx scripts/build-map-land.ts <ne_50m_land.geojson>');
  const geo = JSON.parse(readFileSync(file, 'utf8')) as {
    features: { geometry: { type: string; coordinates: unknown } }[];
  };

  const rings: number[][][] = [];
  for (const feature of geo.features) {
    const { type, coordinates } = feature.geometry;
    const polygons = (type === 'Polygon' ? [coordinates] : coordinates) as number[][][][];
    for (const polygon of polygons) for (const ring of polygon) rings.push(ring);
  }

  const parts: string[] = [];
  let kept = 0;
  for (const ring of rings) {
    // Natural Earth rings repeat their first point at the end; the clipper wants it once.
    const lonLat = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring) as Pt[];
    const projected = lonLat.map((p) => project(p));
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

  const d = parts.join('');
  const out = `/**
 * Land for the two locator maps, as one SVG path (even-odd fill, so lakes and
 * inland seas are holes). GENERATED by scripts/build-map-land.ts from Natural
 * Earth's 1:50m land layer, which is in the public domain
 * (https://www.naturalearthdata.com/about/terms-of-use/). Do not edit by hand:
 * the coordinates are already in the maps' projection (see chokepoint-map-base.tsx),
 * so a change to the map window means running the script again.
 */
export const LAND_PATH =
  '${d}';
`;
  writeFileSync(path.resolve(__dirname, '../src/components/world-land.ts'), out);
  console.log(`${kept} rings kept of ${rings.length}; ${(out.length / 1024).toFixed(1)} KB written`);
}

main();
