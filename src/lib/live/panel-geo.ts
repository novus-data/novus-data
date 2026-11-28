/**
 * The geometry of the per-chokepoint ship panels. Pure; safe anywhere.
 *
 * One module for the view window and the projection, used by BOTH
 * scripts/build-chokepoint-land.ts (which draws the coastline) and the
 * components that plot ships, so a ship and the coast it sits beside can never
 * be projected two different ways.
 *
 * ---------------------------------------------------------------------------
 * THE PROJECTION
 *
 * Equirectangular, with longitude scaled by cos(mid-latitude) of the window.
 * A panel covers a few degrees at most, so that local correction is accurate
 * to well under a pixel, and it stops Dover (51° N) being stretched sideways
 * by about 60%, which a plain lon/lat grid would do.
 *
 * THE WINDOW
 *
 * Each chokepoint's sampling box, padded by WINDOW_PADDING of its size on
 * every side, then widened (or heightened) about its centre to the panel's
 * fixed aspect ratio, so all ten cards are the same shape. The sampling box
 * is always wholly inside the window.
 * ---------------------------------------------------------------------------
 */

import type { BoundingBox, TradeNode } from './types';

/** Panel width in SVG user units. Height follows from PANEL_ASPECT. */
export const PANEL_WIDTH = 320;
/** height ÷ width for every panel. */
export const PANEL_ASPECT = 0.75;
export const PANEL_HEIGHT = PANEL_WIDTH * PANEL_ASPECT;
/** Padding round the sampling box, as a share of its size, per side. */
export const WINDOW_PADDING = 0.35;

export interface PanelWindow {
  nodeId: string;
  /** The window, in degrees. */
  south: number;
  north: number;
  west: number;
  east: number;
  /** cos(mid-latitude): the factor applied to longitude. */
  cosLat: number;
  /** User units per degree of latitude. */
  scale: number;
  /** The sampling box, in degrees, as nodes.ts gives it. */
  box: BoundingBox;
}

export function panelWindow(nodeId: string, box: BoundingBox): PanelWindow {
  const [[south, west], [north, east]] = box;
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  // Padded box, measured in "latitude-degree" units so both axes are comparable.
  let halfHeight = ((north - south) * (1 + 2 * WINDOW_PADDING)) / 2;
  let halfWidth = ((east - west) * cosLat * (1 + 2 * WINDOW_PADDING)) / 2;
  // Grow the shorter side to the panel's aspect.
  if (halfHeight / halfWidth > PANEL_ASPECT) halfWidth = halfHeight / PANEL_ASPECT;
  else halfHeight = halfWidth * PANEL_ASPECT;

  return {
    nodeId,
    south: midLat - halfHeight,
    north: midLat + halfHeight,
    west: midLon - halfWidth / cosLat,
    east: midLon + halfWidth / cosLat,
    cosLat,
    scale: PANEL_WIDTH / (2 * halfWidth),
    box,
  };
}

/** [x, y] in the panel's user units. y grows downward, as in SVG. */
export function project(window: PanelWindow, lat: number, lon: number): [number, number] {
  return [(lon - window.west) * window.cosLat * window.scale, (window.north - lat) * window.scale];
}

/** The inverse of project, for tests. */
export function unproject(window: PanelWindow, x: number, y: number): [number, number] {
  return [window.north - y / window.scale, window.west + x / (window.cosLat * window.scale)];
}

/** The sampling box as an SVG rect: x, y, width, height. */
export function boxRect(window: PanelWindow): { x: number; y: number; width: number; height: number } {
  const [[south, west], [north, east]] = window.box;
  const [x0, y0] = project(window, north, west);
  const [x1, y1] = project(window, south, east);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Every chokepoint that has a sampling box, with its window, in nodes.ts order. */
export function panelWindows(nodes: TradeNode[]): PanelWindow[] {
  return nodes.flatMap((node) => (node.box ? [panelWindow(node.id, node.box)] : []));
}
