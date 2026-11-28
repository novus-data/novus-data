# Novus Data — Vessel layer, Part 1 (data layer only): Claude Code handoff

Written 27 Nov 2026 for a fresh Claude Code session in the repo
`novus-data/novus-data` (checked against `main` at commit `951df0c`). Part 1 of 3.

**How to use this file.** Start a new Claude Code session at the repo root and
paste this whole file as the first message (or save it as
`docs/vessels-part-1.md` and point the session at it). Then read, in this order:
`CLAUDE.md` §1–4, §11, §13, §14.1 (the indicators layer, whose pattern the live layer follows); `DEPLOY.md` Part 5; `DECISIONS.md`;
`src/lib/live/sources/ais.ts`, `src/lib/live/types.ts`, `src/lib/live/nodes.ts`,
`src/lib/live/sources/index.ts`, `src/lib/live/sources/fixtures.ts`,
`src/app/live.json/route.ts`. `CLAUDE.md` ends with a warning that this is
**not the Next.js you know** (Next 16): read the relevant guide in
`node_modules/next/dist/docs/` before writing route or caching code.

**If this file and the repo disagree, the repo and `CLAUDE.md` win.** Say so in
your report; do not silently pick one.

---

## 1. What Gavin wants, and why

Gavin (founder, editor) wants an AIS-style live map on novusdata.news: ships (later
planes) on a map, filterable by cargo and by company, as part of making Novus look
and work like a serious intelligence product. He wants it built **for free**.

What is and is not possible for free (researched 27 Nov 2026):

| Wanted | Free? | Reality |
|---|---|---|
| Ships on a map | Yes | AISStream (free key), terrestrial receivers, chokepoint boxes only |
| Filter ships by type, flag | Yes | Ship type and MMSI-derived flag come from AIS itself |
| Filter by cargo | **No** | AIS has no cargo field, only a coarse ship type. Real cargo data is commercial. Do not infer cargo |
| Filter by company | **Partly** | AIS has no owner field. Part 3 builds a small, sourced table of carriers from their own published fleet lists, matched by IMO number. Covers only matched carriers |
| Planes | Partly | OpenSky: no operator or cargo field; cargo airline is inferred from a callsign-prefix table. Part 3 |
| Trucks | **No** | No public live source exists |

The map is a **differentiator only if it links to the register** (Novus's own
sourced exposure data). Plain tracking maps already exist for free. Part 2 does
that link; Part 1 only builds the data underneath.

## 2. The three parts (only Part 1 is in scope here)

1. **Part 1 (this file): the data layer.** Per-ship records from the existing AIS
   sample, a small static-data registry so ship type survives across samples, flag
   derivation, a hidden machine-readable feed, tests. **No visible UI.**
2. Part 2: zoomed chokepoint panels (SVG, no map library), filter chips, link to
   the register. Separate session.
3. Part 3: carrier table (IMO to carrier, each with a source and date) and planes.
   Separate session.

Do not start Part 2 or 3 work, stubs included.

## 3. What exists today (verified at `951df0c`)

- `src/lib/live/sources/ais.ts` opens one WebSocket to
  `wss://stream.aisstream.io/v0/stream` **per page regeneration**, subscribes to
  every chokepoint box (`CHOKEPOINTS` in `src/lib/live/nodes.ts`: 10 nodes, each
  with a `box: [[south, west], [north, east]]`), listens `AIS_WINDOW_SECONDS = 30`,
  and keeps **counts only** (`createAisAccumulator`, `AisSummary`,
  `parseAis` -> `Reading<AisData>`). It subscribes to
  `FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport']`.
  "No raw messages kept" is a deliberate design choice stated in the file header.
- `/monitor` (`src/app/monitor/page.tsx`) and `/live.json`
  (`src/app/live.json/route.ts`) are `force-static` with the **literal**
  `revalidate = 900` (Next 16 reads it statically; do not import the value). Both
  return 404 unless `monitorEnabled` is true (`src/config/launch.ts`,
  currently `false`). **Do not change `monitorEnabled`.**
- `src/lib/live/sources/index.ts` assembles the snapshot; each source is settled
  independently (`settle`, `withKey`). The AIS key is `AISSTREAM_API_KEY`, server
  only; the build refuses `NEXT_PUBLIC_AISSTREAM_API_KEY`.
- `src/lib/live/sources/fixtures.ts` holds sample payloads used by
  `CONTENT_SOURCE=fixtures` (`npm run dev:demo`). Sample MMSIs start `999`
  (unallocated), so they cannot collide with real ships. The fixtures drive the
  **real** accumulator rather than bypassing it. Keep that pattern.
- `scripts/live-check.ts` reads every feed once for real (`npm run live:check`,
  about 35 seconds with a key; also a GitHub workflow,
  `.github/workflows/live-check.yml`, which already reads the repo secret
  `AISSTREAM_API_KEY`). It never fails because a feed is down, and never prints a key.
- Tests are plain `tsx` scripts in `scripts/tests/`, run by
  `npm run test:regressions` (no test framework; CLAUDE.md §13 says do not add one).
- Lint boundary: pages import from `@/lib/live` (the index), never from
  `@/lib/live/sources/*` (`eslint.config.mjs`). Pure type and constant modules are
  safe for client components; anything that reaches the network is not.
- Supabase is already a dependency (`@supabase/supabase-js`, `@supabase/ssr`) and
  `ACCOUNT_STORE=supabase` is an existing, switched-off feature. CLAUDE.md §13 says
  no data is stored in this repository; Supabase holds rows.

## 4. Rules that bind this work (from CLAUDE.md; read the originals)

- **Rule 1, no fabricated data.** Never invent a ship type, flag, owner, cargo or
  count. Unknown is a valid, displayed state. Fixture strings carry `[SAMPLE]`.
- **Rule 3, no unlicensed third-party assets/data.** Any table you embed (ship-type
  codes, MID-to-country list) must come from a **citable public source** recorded
  in a comment with URL and retrieval date. If you cannot source it, do not embed
  it; fall back to "unknown".
- **Rule 4, ask before installing.** **No new dependencies.** Supabase's client is
  already installed.
- **Rule 5, never commit secrets.** `.env.example` gets keys with empty values only.
- **Rule 7, do not touch external accounts.** Do not log into Supabase, Vercel,
  GitHub settings or AISStream. Anything needing account access becomes numbered
  instructions in `DEPLOY.md` for Alex.
- **Section 13, out of scope.** No scheduled workflow, no push notifications, no
  price feeds, no test framework, no analytics. Part 1 adds none of them.
- **The live layer's one rule (`src/lib/live/types.ts` header).** Age comes from a
  timestamp inside the upstream data (each vessel's own message time), never from
  when our code ran. A reading that failed carries no data and no stale
  placeholder.
- **Places, not companies.** `nodes.ts` names places only. Part 1 must not attach
  any company name to anything. Company claims belong to the register and Part 3.
- **The reader may be evaluating the author.** Understatement passes; overstatement
  fails. Every caveat the existing AIS file prints (zero means no signal, not no
  ship; stationary vessels are undercounted; coverage is terrestrial) must be
  carried into any new output.

## 5. Part 1 deliverables

### D1. Pure vessel types and tables: `src/lib/live/vessels.ts`
Client-safe (no network, no env, no Node-only imports). Contains:
- `VesselSighting`: mmsi (string), lat, lon, sog (knots or null), cog (or null),
  heading (or null), `seenAt` (ISO, from the message's own `time_utc`), `nodeId`
  (which chokepoint box).
- `VesselStatic`: mmsi, name (sanitised, or null), imo (or null), callsign (or
  null), shipType (AIS code 0-99 or null), `staticSeenAt`.
- `VesselRecord`: a sighting joined with whatever static data is known, plus
  `category` (see below), `flag` (country or null) and `typeSource`
  (`'this-sample' | 'registry' | 'unknown'`) so Part 2 can say how it knows.
- `shipCategory(code | null)`: maps an AIS ship-type code to a **coarse** category:
  `cargo | tanker | passenger | fishing | tug-special | high-speed | sailing-pleasure | military | other | unknown`.
  See appendix A. Hazard digit (second digit on 70-99) is ignored for category.
- `flagFromMmsi(mmsi)`: derives a country from the first three digits (MID) using
  the ITU Maritime Identification Digits table. **Only embed it if you can cite the
  ITU list and retrieval date**; if a MID is not in the table return `null`. The
  doc comment must say a MID reflects where the MMSI was issued, which usually but
  not always equals the flag state. Label the field "flag (from MMSI)" everywhere.
- `sanitiseShipText(raw)`: AIS name, callsign and destination are free text typed
  by crews. Strip control characters, collapse whitespace, trim trailing `@`
  padding, cap at 40 chars, return null if empty. Treat as **untrusted**: never
  render as HTML, never pass to a URL or query without encoding.

### D2. Sampler change: `src/lib/live/sources/ais.ts`
- Add `'ShipStaticData'` (and `'StaticDataReport'` for Class B) to
  `FilterMessageTypes`. **Verify the real field names first** (step 1 below);
  from memory of AISStream's published schema, `ShipStaticData` carries `Name`,
  `Type`, `ImoNumber`, `CallSign`, `Destination`, `Dimension`,
  `MaximumStaticDraught`, but the docs page fetched on 27 Nov did not list them,
  so treat that as **unverified** until you see a real message.
- Extend `createAisAccumulator` to also keep, per MMSI: the latest sighting
  inside a chokepoint box and any static data heard. The **existing counts must
  come out identical** (the existing counting code path stays; new fields are
  additive). Add a regression test proving counts are unchanged for a fixed
  message sequence.
- **Cap the payload.** At most 400 vessels per box and 2,000 in total. Selection is
  deterministic: underway first, then lowest MMSI. Record how many were dropped
  (`capped: number`) and print it. Never silently truncate.
- Keep one socket per regeneration. Do not add a second connection (AISStream
  allows 3 per account; `/monitor` and `/live.json` regenerate independently).
  Keep the window at 30 s unless step-1 evidence shows a change is justified;
  if you change it, say why in the PR.
- The key stays server-only and out of every Reading, error and log, as today.

### D3. Registry: `src/lib/live/registry/`
A small store of **static attributes only**, so a ship's type survives between
15-minute samples (static messages are broadcast about every 6 minutes, so most
30-second samples hear few of them).
- Interface `VesselRegistry { lookup(mmsis: string[]): Promise<Map<string, VesselStatic>>; upsert(records: VesselStatic[]): Promise<void> }`.
- `memory` implementation (tests, `dev:demo`).
- `supabase` implementation using the **already-installed** client with the
  server-only service-role key. Table `vessel_static`: `mmsi text primary key`,
  `name text`, `imo integer`, `callsign text`, `ship_type smallint`,
  `static_seen_at timestamptz not null`, `updated_at timestamptz not null default now()`.
  RLS **enabled with no policies** (service role only); no public read.
- Selected by a new env var `VESSEL_STORE` = `none` (default) | `memory` | `supabase`.
  With `none`, the feed still works; type is known only for ships whose static
  message arrived in the same sample, and everything else is `unknown`.
- **Store no positions and no history.** Not now, not as a convenience. The registry
  holds static attributes and a last-seen time, nothing that forms a track.
- Writes are idempotent upserts keyed by MMSI. A registry that is down or
  misconfigured must degrade to `none` behaviour with a note, never fail the
  reading (same isolation rule as `settle`).
- Write the SQL (create table, enable RLS, revoke public access) as a numbered
  step in `DEPLOY.md`, new Part "Vessel registry (optional)". **Do not run it.**
  It is Alex's to run in the Supabase SQL editor (Rule 7).
- Design call to flag, not hide: writing to a database as a side effect of a static
  page regeneration is unusual. It is acceptable here because the upsert is
  idempotent and bounded, but state the alternative (a separate scheduled job,
  currently out of scope per §13) in the PR so Alex can choose.

### D4. Hidden feed: `src/app/vessels.json/route.ts`
- `force-static`, literal `revalidate = 900`, `maxDuration = 60`, returns 404 unless
  `monitorEnabled` (same gate as `/live.json`).
- Shape: `{ generatedAt, asOf, asOfBasis, windowSeconds, source: {name, publisher, terms, homepage}, caveats: string[], capped, byType: {...counts...}, typeKnown: n, typeUnknown: n, vessels: VesselRecord[] }`
  or the existing three-state Reading shape for `unavailable` / `not-configured`.
- `asOf` is the latest vessel message time, not `generatedAt`. Same warning text as
  `/live.json` about what each field means. Terms travel with the data.
- **Do not add vessels to `/live.json`** and do not change that file's shape.

### D5. Fixtures
- Extend `fixtureAis()` so the fixture feed contains position and static messages
  for several `999…` sample ships across at least three boxes, including: a ship
  with static data, a ship with none (type unknown), a Class B vessel, one with the
  speed-unavailable sentinel (102.3), one outside every box, and one with hostile
  text in its name (`<script>`, control characters, 200 characters).
- Everything must flow through the real accumulator.

### D6. Tests: `scripts/tests/vessels.ts`
Add to `test:regressions`. Cover: counts unchanged vs the old logic; category map
for every code class in appendix A; MID flag (known, unknown, malformed MMSI);
sanitiser (control chars, `@` padding, length cap, empty); cap and `capped`
accounting; registry merge (this-sample beats registry; registry fills gaps;
`typeSource` correct); registry failure degrades to `none` with a note; feed
returns 404 when `monitorEnabled` is false; no field of any output contains the
API key string (set a canary key and grep the serialised output).

### D7. Live verification tooling
- Extend `scripts/live-check.ts` to print, for AIS: total vessels heard, how many
  had a type from this sample, how many from the registry, how many unknown, and
  how many static messages arrived. Still never fails on feed outages, never prints
  the key.
- Add `scripts/ais-capture.ts` (`npm run ais:capture`): connects with the key from
  the environment, listens 60 s, and writes up to 200 **raw** messages of each type
  to a **git-ignored** file (add the path to `.gitignore`). It exists so a person
  with a key can capture the real message shape and send it back; nothing from it
  is committed or published. Never log the key.

### D8. Docs
- `.env.example`: `VESSEL_STORE=` (empty, with a comment). No new secrets beyond
  the existing Supabase ones.
- `CLAUDE.md` §11 (env table), plus a **new short section** for the live layer:
  `src/app/monitor/page.tsx` and `src/app/live.json/route.ts` cite "CLAUDE.md §6d",
  but `CLAUDE.md` has no such section (checked 27 Nov). Add one (call it §6d so the
  existing comments resolve) covering the per-vessel sample, the registry, the
  hidden feed, and the "static only, no tracks" rule, and mention the dangling
  reference in your report.
- `DEPLOY.md`: the registry SQL step, and a line in Part 5 saying the AIS key
  is still the only thing needed for ship counts.
- `DECISIONS.md`: add a **draft, unapproved** entry "Per-ship data on the monitor"
  recording what is built and what both founders must decide (see section 7).
  Do not mark it agreed.

## 6. Order of work

1. **Confirm the message shape.** Without a key you cannot see real messages. Read
   AISStream's docs page and schema explorer
   (`https://aisstream.io/documentation`), note what is documented and what is
   not, and build D1/D2 against the documented shape plus clearly marked
   assumptions. Ship `ais:capture` (D7) early so the real shape can be checked.
2. D1 (pure types and tables), with sources cited in comments.
3. Tests for D1.
4. D2 sampler change, with the counts-unchanged regression test written **first**.
5. D3 registry (memory first, then Supabase), D4 feed, D5 fixtures.
6. D6 remaining tests, D7, D8.
7. `npm run check` and `npm run test:regressions`, then `npm run build` (strict)
   and `npm run dev:demo` with `monitorEnabled` temporarily true **locally only**
   to look at `/vessels.json`. Revert the flag before committing; confirm with
   `git diff` that `launch.ts` is untouched.

## 7. Decisions that are NOT yours to make (surface them, do not decide them)

- Turning the monitor, or any per-ship display, on: needs Gavin and Alex to agree,
  recorded in `DECISIONS.md`.
- Whether to show individual ships by name and MMSI on a public page (AIS is a
  public broadcast, but publishing a named-vessel map is a product and reputation
  call). Part 1 builds the feed and leaves it hidden.
- Whether Novus may rely on AISStream commercially: its documentation states no
  terms of service and no uptime guarantee. Alex or Gavin should email AISStream
  and record the answer. Do not assert the terms are fine.
- Registry retention (for example drop rows not seen in 90 days). Propose, don't set.
- Whether to use Supabase or a file-based registry. Default to `none`; both are
  implemented behind the interface.

## 8. Calls made in this handoff (the person reading the PR should check them)

1. Per-ship data is **not** added to `/live.json`; it gets its own hidden feed.
2. The registry stores **static attributes only**, never positions or history.
3. The vessel cap is 400 per box and 2,000 total, with the drop count reported.
4. The 30 s window is unchanged unless evidence says otherwise.
5. Coarse categories only; **no cargo claims**, ever, from AIS. Ship type is shown as
   type.
6. Flag is derived from MMSI and labelled as such.
7. `VESSEL_STORE` defaults to `none`, so merging Part 1 changes nothing for anyone.

## 9. Acceptance criteria (all must hold)

- [ ] `npm run check`, `npm run test:regressions` and `npm run build` pass.
- [ ] `monitorEnabled` is still `false`; `/monitor`, `/live.json`, `/vessels.json`
      all 404 in a normal production build.
- [ ] With the flag true locally and `dev:demo`, `/live.json` is **byte-for-byte
      the same shape** as before and `/vessels.json` validates against the shape in D4.
- [ ] Existing chokepoint counts are identical before and after (regression test).
- [ ] No new dependency (`git diff package.json package-lock.json` is empty).
- [ ] The canary-key test passes; no secret appears in any output, error or log.
- [ ] No position or track is persisted anywhere.
- [ ] Every embedded table cites its public source and retrieval date, or is absent.
- [ ] Unknown type and unknown flag render as `unknown`/`null`, never a guess.
- [ ] The PR states what was **not** verified live (see section 10).

## 10. What cannot be verified in this session, and who does it

- Real AISStream messages: needs the key. Claude Code's sandbox may also not reach
  `stream.aisstream.io` (outbound access is allowlisted). Say which applies.
- **Alex** (or Gavin) creates the free AISStream key (sign in at aisstream.io; no
  payment), adds it as the repo secret `AISSTREAM_API_KEY` and as a Vercel
  environment variable of the same name (Production, then redeploy). The key is
  never pasted into chat, email or a commit.
- Then they run the `live-check` workflow (`workflow_dispatch`) or `npm run
  live:check` and `npm run ais:capture` locally, and give you the log or the
  capture file. **Only then** are the field names in D2 confirmed.
- **Alex** runs the registry SQL in Supabase and sets `VESSEL_STORE=supabase`, if
  they choose to use the registry.

## 11. Hostile and malformed data

AIS is received over radio from anyone. Treat every field as untrusted: numbers may
be out of range (lat > 90, speed sentinels, MMSI of the wrong length), names may be
long, padded, or contain markup. Validate ranges, drop invalid sightings and count
the drops in a note. Messages for MMSIs that are not 9 digits are dropped. Never
build SQL by string concatenation (use the client's parameterised calls).

## 12. Reporting back and the pull request

- Branch `claude/vessels-part-1`. Open a **draft PR** against `main`. Do not
  merge, do not push to `main`, do not change repository, Vercel or Supabase
  settings. If you cannot push, produce a patch file and say so.
- Gavin prefers results-first, plain language, and no technical walkthrough. The
  PR description, and your final message to him, should open with three plain lines:
  what now exists, what is still switched off, and what Alex must do next.
  Technical detail goes below that.
- List explicitly: the calls in section 8, what is unverified (section 10), and
  anything in this file that conflicted with the repo.
- Do not tell Gavin the feature "works" on live data. It has only been tested on
  fixtures until Alex's capture comes back. Say exactly that.

---

## Appendix A. AIS ship-type codes (ITU-R M.1371), for the category map

From memory of the standard; **verify against ITU-R M.1371 or another citable
public reference and cite it in the code comment before relying on this table.**

| Code | Meaning | Category |
|---|---|---|
| 20-29 | Wing in ground | other |
| 30 | Fishing | fishing |
| 31, 32 | Towing | tug-special |
| 33, 34 | Dredging, diving ops | tug-special |
| 35 | Military | military |
| 36 | Sailing | sailing-pleasure |
| 37 | Pleasure craft | sailing-pleasure |
| 40-49 | High-speed craft | high-speed |
| 50-59 | Pilot, SAR, tug, port tender, anti-pollution, law enforcement, medical, non-combatant | tug-special |
| 60-69 | Passenger | passenger |
| 70-79 | Cargo | cargo |
| 80-89 | Tanker | tanker |
| 90-99 | Other | other |
| 0, missing | Not available | unknown |

On 70-99 the second digit is a hazardous-cargo category, **not** a description of
what the ship carries; do not turn it into a cargo claim.

## Appendix B. Message fields to check against a real capture

`MetaData`: `MMSI`, `ShipName`, `latitude`, `longitude`, `time_utc` (Go format,
already handled by `aisTime`). `PositionReport`: `Sog` (102.3 means unavailable),
`Cog`, `TrueHeading`, `NavigationalStatus`. `ShipStaticData` (unverified): `Name`,
`Type`, `ImoNumber`, `CallSign`, `Destination`, `Dimension`,
`MaximumStaticDraught`. Confirm each, and the Class B equivalent, from a capture.
