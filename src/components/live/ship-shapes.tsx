import type { ShipCategory } from '@/lib/live/vessels';

/**
 * How a ship is drawn on the chokepoint panels: by SHAPE, never by colour.
 *
 * Every ship is the same ink (`--accent-text`, the link colour). The register
 * status colours (`--status-*`) are never used here: on this site they mean a
 * register entry's status and nothing else (CLAUDE.md §6a). A ship not under
 * way is drawn smaller and lighter. Shapes were chosen to stay distinct in
 * greyscale at phone width: three filled solids of different outline, a
 * filled diamond, a plus, a hollow ring and a diagonal cross.
 *
 * High-speed craft, sailing and pleasure craft and military operations share
 * the "other" cross. Three more shapes at this size would not stay distinct,
 * and those types are rare at these straits.
 */

export type ShipShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'plus' | 'ring' | 'cross';

export const SHAPE_FOR: Record<ShipCategory, ShipShape> = {
  cargo: 'circle',
  tanker: 'square',
  passenger: 'triangle',
  fishing: 'diamond',
  'tug-special': 'plus',
  'high-speed': 'cross',
  'sailing-pleasure': 'cross',
  military: 'cross',
  other: 'cross',
  unknown: 'ring',
};

/** The key, in order, each shape with its words. */
export const SHAPE_KEY: { shape: ShipShape; label: string }[] = [
  { shape: 'circle', label: 'Cargo ship' },
  { shape: 'square', label: 'Tanker' },
  { shape: 'triangle', label: 'Passenger ship' },
  { shape: 'diamond', label: 'Fishing vessel' },
  { shape: 'plus', label: 'Tug, pilot or service craft' },
  { shape: 'cross', label: 'Other type (high-speed, sailing, pleasure, military, other)' },
  { shape: 'ring', label: 'Type not heard' },
];

/** Radius of a ship under way, in panel units. */
export const SHIP_RADIUS = 3.6;

/**
 * One ship shape centred on (x, y). `quiet` draws a ship not under way:
 * smaller and lighter. Filled shapes get a thin outline in the box colour so
 * neighbours stay apart where ships bunch.
 */
export function ShipMark({
  shape,
  x,
  y,
  quiet = false,
  r = SHIP_RADIUS,
}: {
  shape: ShipShape;
  x: number;
  y: number;
  quiet?: boolean;
  r?: number;
}) {
  const size = quiet ? r * 0.7 : r;
  const opacity = quiet ? 0.55 : 1;
  const filled = { className: 'fill-link stroke-surface', strokeWidth: 0.6, opacity };
  const stroked = { className: 'stroke-link', fill: 'none', strokeWidth: quiet ? 1.1 : 1.5, strokeLinecap: 'round' as const, opacity };

  switch (shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={size} {...filled} />;
    case 'square': {
      const half = size * 0.9;
      return <rect x={x - half} y={y - half} width={half * 2} height={half * 2} {...filled} />;
    }
    case 'triangle': {
      const h = size * 1.15;
      return <polygon points={`${x},${y - h} ${x + h},${y + h * 0.8} ${x - h},${y + h * 0.8}`} {...filled} />;
    }
    case 'diamond': {
      const d = size * 1.2;
      return <polygon points={`${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`} {...filled} />;
    }
    case 'plus':
      return <path d={`M${x - size} ${y}H${x + size}M${x} ${y - size}V${y + size}`} {...stroked} />;
    case 'ring':
      return <circle cx={x} cy={y} r={size * 0.85} {...stroked} />;
    case 'cross': {
      const c = size * 0.8;
      return <path d={`M${x - c} ${y - c}L${x + c} ${y + c}M${x + c} ${y - c}L${x - c} ${y + c}`} {...stroked} />;
    }
  }
}

/** A shape on its own, for the key and table rows. Decorative: its word always sits beside it. */
export function ShipIcon({ shape, quiet = false }: { shape: ShipShape; quiet?: boolean }) {
  return (
    <svg viewBox="-6 -6 12 12" width="14" height="14" aria-hidden="true" className="shrink-0">
      <ShipMark shape={shape} x={0} y={0} quiet={quiet} r={4} />
    </svg>
  );
}
