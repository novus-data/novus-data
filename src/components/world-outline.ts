/**
 * The sea lanes drawn on the locator maps, as [longitude, latitude] pairs.
 *
 * The land itself is in world-land.ts, generated from Natural Earth's public
 * domain data. The lanes are different: hand-placed, deliberately loose, and
 * context only. Where the chokepoints sit comes from src/lib/live/nodes.ts.
 */

type Outline = ReadonlyArray<readonly [number, number]>;

/**
 * The main sea lanes, for context only: where ships run between the
 * chokepoints. Drawn faint and unlabelled. They are geography, not a
 * measurement, and carry no volumes or counts (Rule 1).
 */
export const LANES: Outline[] = [
  // Asia to northern Europe through Malacca, Bab el-Mandeb, Suez and Gibraltar.
  [
    [121.6, 30.6], [122, 27], [119.8, 24.3], [117, 22], [110, 13], [105, 5], [103.95, 1.25],
    [100.5, 3.3], [97, 5.8], [90, 6], [80.5, 5.6], [70, 9], [57, 13], [51, 12.6], [43.4, 12.65],
    [39, 18.5], [35, 26], [32.4, 30.6], [29, 33], [20, 34.5], [11, 37.3], [3, 37.5],
    [-5.55, 35.98], [-10, 38], [-10, 44], [-5.5, 48.5], [1.5, 51.02], [4.05, 51.95],
  ],
  // Out of the Gulf through Hormuz.
  [[50.5, 27], [56.4, 26.55], [58.5, 24.8], [60, 22], [63, 17], [70, 9]],
  // Out of the Black Sea through the Bosphorus.
  [[29.07, 41.1], [27, 40.3], [26, 39], [25, 36.5], [20, 34.5]],
  // Round the Cape of Good Hope: the Red Sea diversion.
  [
    [80.5, 5.6], [60, -10], [40, -30], [18.5, -36], [12, -30], [8, -20], [-5, -5], [-18, 10],
    [-18, 25], [-12, 36], [-10, 38],
  ],
  // US East Coast to Asia through Panama.
  [
    [-74, 40.4], [-73, 33], [-74, 25], [-77, 17], [-79.75, 9.15], [-82, 7], [-95, 10],
    [-115, 20], [-140, 28],
  ],
  // Across the Pacific from East Asia.
  [[122, 30.7], [135, 33], [155, 38]],
];
