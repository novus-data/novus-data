/**
 * The in-memory vessel registry: tests and `npm run dev:demo` only.
 *
 * Lives for one process and forgets everything on restart. The selector in
 * ./index.ts refuses it in a production build (it degrades to "none" with a
 * note), because on Vercel each function instance would keep its own copy and
 * readers would see type coverage jump between regenerations for no reason.
 */

import type { VesselStatic } from '../vessels';
import type { VesselRegistry } from './types';

export function createMemoryRegistry(): VesselRegistry {
  const rows = new Map<string, VesselStatic>();
  return {
    name: 'memory',
    async lookup(mmsis) {
      const found = new Map<string, VesselStatic>();
      for (const mmsi of mmsis) {
        const row = rows.get(mmsi);
        if (row) found.set(mmsi, { ...row });
      }
      return found;
    },
    async upsert(records) {
      for (const record of records) rows.set(record.mmsi, { ...record });
    },
  };
}

/** One registry per process, so successive regenerations in `dev:demo` share it. */
let shared: VesselRegistry | null = null;
export function sharedMemoryRegistry(): VesselRegistry {
  shared ??= createMemoryRegistry();
  return shared;
}
