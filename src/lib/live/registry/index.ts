/**
 * Chooses the vessel registry from VESSEL_STORE. SERVER ONLY.
 *
 *   none (default, or unset)   no registry: a ship's type is known only if its
 *                              static message arrived in the same sample
 *   memory                     one process, development and tests only
 *   supabase                   the vessel_static table (DEPLOY.md)
 *
 * A registry that is misconfigured or down never fails the reading. It
 * degrades to "none" and says so in a note — the same isolation rule as
 * `settle` in ../sources/index.ts. Notes are sentences written here, never an
 * upstream error, so they cannot carry a key or a project name.
 */

import type { VesselRegistry, VesselStoreName } from './types';

export type { VesselRegistry, VesselStoreName } from './types';
export { createMemoryRegistry } from './memory';

export function vesselStoreName(): VesselStoreName | 'invalid' {
  const value = process.env.VESSEL_STORE?.trim().toLowerCase();
  if (!value || value === 'none') return 'none';
  if (value === 'memory' || value === 'supabase') return value;
  return 'invalid';
}

export async function getVesselRegistry(): Promise<{ registry: VesselRegistry | null; notes: string[] }> {
  const store = vesselStoreName();
  if (store === 'none') return { registry: null, notes: [] };
  if (store === 'invalid') {
    return { registry: null, notes: ['VESSEL_STORE has an unrecognised value, so no vessel registry was used.'] };
  }
  if (store === 'memory') {
    if (process.env.NODE_ENV === 'production') {
      return {
        registry: null,
        notes: ['VESSEL_STORE=memory is for development only and was ignored in this production build.'],
      };
    }
    const { sharedMemoryRegistry } = await import('./memory');
    return { registry: sharedMemoryRegistry(), notes: [] };
  }
  try {
    const { createSupabaseRegistry } = await import('./supabase');
    return { registry: await createSupabaseRegistry(), notes: [] };
  } catch {
    return {
      registry: null,
      notes: ['The vessel registry (Supabase) is not configured correctly, so ship types come from this sample only.'],
    };
  }
}
