import { publication } from '@/config/publication';
import { monitorEnabled } from '@/config/launch';
import { absoluteUrl } from '@/lib/env';
import { LIVE_REVALIDATE_SECONDS, SOURCE_META, getVesselFeed, vesselCaveats } from '@/lib/live';

/**
 * Per-vessel AIS records at the chokepoints, machine-readable. HIDDEN: it 404s
 * unless `monitorEnabled` is on, the same gate as /monitor and /live.json, and
 * nothing on the site links to it. CLAUDE.md §6d.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS NOT PART OF /live.json
 *
 * /live.json is the seam a watcher diffs, and its shape is a contract. A list
 * of up to two thousand vessels would multiply its size and change what it
 * is. Per-vessel data also raises a separate product question — whether Novus
 * shows individual ships by name — which both founders decide (DECISIONS.md,
 * "Per-ship data on the monitor"). So it has its own file.
 *
 * ---------------------------------------------------------------------------
 * THE TWO FIELDS A CONSUMER MUST READ
 *
 * `asOf` is the time of the latest vessel message received, taken from inside
 * the AIS data. Each vessel's own `seenAt` is its message time. `generatedAt`
 * is when this file was assembled; it is cached for up to fifteen minutes,
 * so treating it as the data's age is wrong in exactly the way the live layer
 * exists to prevent (src/lib/live/types.ts).
 *
 * A reading whose `status` is not "ok" carries no vessels and no stale list.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT SAY
 *
 * No cargo, owner or operator: AIS carries none. Ship type is a coarse
 * category or "unknown". Flag is "flag (from MMSI)". `caveats` travels with
 * the data, because the file travels without its page.
 *
 * Names and call signs are untrusted radio text. They are sanitised, but a
 * consumer must still escape them before rendering.
 *
 * SECRETS: the AISStream key is read inside the adapter and never stored on
 * a Reading. Nothing here can carry it. scripts/tests/vessels.ts checks.
 * ---------------------------------------------------------------------------
 */

export const dynamic = 'force-static';
// Literal, for the same reason as /live.json: Next 16 reads this statically.
export const revalidate = 900;
export const maxDuration = 60;

export async function GET() {
  if (!monitorEnabled) return new Response(null, { status: 404 });

  const reading = await getVesselFeed();
  const meta = SOURCE_META.ais;

  const header = {
    version: 1,
    title: `${publication.name} — vessels heard at chokepoints`,
    home_page_url: absoluteUrl('/monitor'),
    feed_url: absoluteUrl('/vessels.json'),
    description:
      'Vessels heard by AIS terrestrial receivers inside ten chokepoint boxes during one short sample, ' +
      'each with its latest position in the sample and whatever static attributes it broadcast. ' +
      'Not assessments; does not feed the register. asOf — the latest vessel message — is the only valid measure of age.',
    refresh_seconds: LIVE_REVALIDATE_SECONDS,
    generatedAt: new Date().toISOString(),
    source: { name: meta.name, publisher: meta.publisher, terms: meta.terms, homepage: meta.homepage },
  };

  if (reading.status !== 'ok') {
    // The three-state Reading, unchanged: no data, no placeholder.
    return Response.json({ ...header, ...reading });
  }

  const { data } = reading;
  return Response.json({
    ...header,
    status: reading.status,
    asOf: reading.asOf,
    asOfBasis: reading.asOfBasis,
    windowSeconds: data.windowSeconds,
    sampledAt: data.sampledAt,
    caveats: vesselCaveats(data.windowSeconds),
    notes: reading.notes,
    heard: data.heard,
    capped: data.capped,
    staticMessages: data.staticMessages,
    byType: data.byType,
    typeKnown: data.typeKnown,
    typeUnknown: data.typeUnknown,
    typeFromSample: data.typeFromSample,
    typeFromRegistry: data.typeFromRegistry,
    /**
     * The carrier fleet lists held (no IMO lists), so each vessel's
     * `carrierIds` can be read: name, the list's own wording, its date and
     * source. A match means the ship's broadcast IMO appears in that list,
     * nothing more. `carrierMatched` counts vessels with at least one match.
     */
    carriers: data.carriers,
    carrierMatched: data.carrierMatched,
    /**
     * Field guide: mmsi (9 digits), lat/lon (degrees), sog (knots|null),
     * cog/heading (degrees true|null), seenAt (that vessel's message time),
     * nodeId (chokepoint box), name/callsign (untrusted text|null), imo,
     * shipType (AIS code 1–99|null), category, flag ("flag (from MMSI)"|null),
     * typeSource ('this-sample'|'registry'|'unknown'), staticSeenAt.
     */
    vessels: data.vessels,
  });
}
