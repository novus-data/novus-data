/**
 * The vessel registry — static attributes only.
 *
 * Static AIS messages (name, call sign, IMO, ship type) are broadcast about
 * every six minutes, so a thirty-second sample hears few of them. Without
 * somewhere to remember them, almost every vessel in a sample would be "type
 * unknown". The registry is that somewhere, and nothing more.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT MUST NEVER HOLD
 *
 * No position, no course, no speed, no box, no history. A row is one vessel's
 * latest static attributes and when they were broadcast. Storing positions
 * would turn a sample into a track, which is a different product with
 * different obligations, and it is not built. `VesselStatic` has no field for
 * any of it, so there is structurally nowhere to put one.
 * ---------------------------------------------------------------------------
 */

import type { VesselStatic } from '../vessels';

export interface VesselRegistry {
  /** Which store this is, for notes and the live check. */
  readonly name: 'memory' | 'supabase';
  /** Known static attributes for these MMSIs. MMSIs with no row are simply absent. */
  lookup(mmsis: string[]): Promise<Map<string, VesselStatic>>;
  /** Idempotent: one row per MMSI, replaced in full. Callers merge before writing. */
  upsert(records: VesselStatic[]): Promise<void>;
}

export type VesselStoreName = 'none' | 'memory' | 'supabase';
