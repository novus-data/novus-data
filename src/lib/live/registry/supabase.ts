/**
 * The Supabase vessel registry. SERVER ONLY.
 *
 * Table `vessel_static` (DEPLOY.md, "Vessel registry (optional)"), with
 * row-level security ENABLED and NO policies: neither the anon key nor a
 * signed-in reader can read or write it. Only the service-role client can,
 * which is why this module uses it — the second, and only other, use of that
 * key after account deletion (see src/lib/supabase/admin.ts).
 *
 * Every call goes through the client's parameterised query builder; nothing
 * is ever concatenated into SQL. Rows read back are validated as strictly as
 * radio input, because a table is only as trustworthy as what wrote to it.
 */

import { normaliseMmsi, normaliseShipType, sanitiseShipText, type VesselStatic } from '../vessels';
import type { VesselRegistry } from './types';

const TABLE = 'vessel_static';
/** MMSIs per `in()` filter. It travels in the URL, so it stays well below URL length limits. */
const LOOKUP_CHUNK = 200;
const UPSERT_CHUNK = 500;

interface Row {
  mmsi: string;
  name: string | null;
  imo: number | null;
  callsign: string | null;
  ship_type: number | null;
  static_seen_at: string;
  updated_at: string;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fromRow(row: unknown): VesselStatic | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const mmsi = normaliseMmsi(r.mmsi);
  const seen = typeof r.static_seen_at === 'string' ? new Date(r.static_seen_at) : null;
  if (!mmsi || !seen || Number.isNaN(seen.getTime())) return null;
  const imo = typeof r.imo === 'number' && Number.isInteger(r.imo) && r.imo >= 1_000_000 && r.imo <= 9_999_999 ? r.imo : null;
  return {
    mmsi,
    name: sanitiseShipText(r.name),
    imo,
    callsign: sanitiseShipText(r.callsign),
    shipType: normaliseShipType(typeof r.ship_type === 'number' ? r.ship_type : null),
    staticSeenAt: seen.toISOString(),
  };
}

export async function createSupabaseRegistry(): Promise<VesselRegistry> {
  // Dynamic, so a build with VESSEL_STORE unset never pulls the client in
  // (CLAUDE.md §7). admin.ts carries the NEXT_PUBLIC_ and browser guards.
  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
  const client = createSupabaseAdminClient();

  return {
    name: 'supabase',
    async lookup(mmsis) {
      const found = new Map<string, VesselStatic>();
      const valid = [...new Set(mmsis.map((m) => normaliseMmsi(m)).filter((m): m is string => m !== null))];
      for (const batch of chunks(valid, LOOKUP_CHUNK)) {
        const { data, error } = await client
          .from(TABLE)
          .select('mmsi, name, imo, callsign, ship_type, static_seen_at')
          .in('mmsi', batch);
        // The upstream message is not echoed: it can name the project or the query.
        if (error) throw new Error('vessel registry lookup failed');
        for (const row of data ?? []) {
          const record = fromRow(row);
          if (record) found.set(record.mmsi, record);
        }
      }
      return found;
    },
    async upsert(records) {
      // updated_at is when this row was written — bookkeeping for retention,
      // never shown as the age of anything.
      const writtenAt = new Date().toISOString();
      const rows: Row[] = records.map((record) => ({
        mmsi: record.mmsi,
        name: record.name,
        imo: record.imo,
        callsign: record.callsign,
        ship_type: record.shipType,
        static_seen_at: record.staticSeenAt,
        updated_at: writtenAt,
      }));
      for (const batch of chunks(rows, UPSERT_CHUNK)) {
        const { error } = await client.from(TABLE).upsert(batch, { onConflict: 'mmsi' });
        if (error) throw new Error('vessel registry write failed');
      }
    },
  };
}
