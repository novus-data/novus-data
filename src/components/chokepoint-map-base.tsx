import { LAND, LANES, WATER } from '@/components/world-outline';

/*
 * The visible window: Panama to Japan, Scandinavia to the Cape, which is the
 * tightest box that holds every tracked chokepoint and its label. Wider
 * windows spent a third of the frame on ocean and continental interior with
 * no marker in it. Equirectangular, because a locator map only has to say
 * "here", and a plain lon/lat grid keeps the coordinates readable in code.
 *
 * Shared by the home page map (chokepoint-map.tsx) and the Mancalë page map
 * (mancale/mancale-map.tsx), so the two cannot drift apart.
 */
const WEST = -100;
const EAST = 145;
const NORTH = 60;
const SOUTH = -44;
export const WIDTH = 1000;
const SCALE = WIDTH / (EAST - WEST);
export const HEIGHT = Math.round((NORTH - SOUTH) * SCALE);

export function project([lon, lat]: readonly [number, number]): [number, number] {
  return [(lon - WEST) * SCALE, (NORTH - lat) * SCALE];
}

function points(outline: ReadonlyArray<readonly [number, number]>): string {
  return outline
    .map((point) =>
      project(point)
        .map((value) => value.toFixed(1))
        .join(','),
    )
    .join(' ');
}

/**
 * The drawing both locator maps share: the frame, the coastlines and the
 * dashed sea lanes. The caller draws its markers on top, inside its own
 * <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>.
 */
export function MapBase() {
  return (
    <>
      <rect width={WIDTH} height={HEIGHT} className="fill-ink" />

      {LAND.map((outline, index) => (
        <polygon
          key={`land-${index}`}
          points={points(outline)}
          className="fill-surface-2 stroke-rule"
          strokeWidth={0.75}
          strokeLinejoin="round"
        />
      ))}
      {WATER.map((outline, index) => (
        <polygon
          key={`water-${index}`}
          points={points(outline)}
          className="fill-ink stroke-rule"
          strokeWidth={0.75}
          strokeLinejoin="round"
        />
      ))}

      {LANES.map((lane, index) => (
        <polyline
          key={`lane-${index}`}
          points={points(lane)}
          fill="none"
          className="stroke-accent"
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}
