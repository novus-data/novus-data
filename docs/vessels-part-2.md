# Novus Data — Vessel layer, Part 2 (the map and filters): Claude Code handoff

Written 27 Nov 2026 for a fresh Claude Code session in `novus-data/novus-data`
(repo read at `main` commit `951df0c`; Part 1 was **not yet merged** when this was
written). Part 2 of 3. Companion to `claude/82-Vessel-Layer-Part-1-Claude-Code-Handoff-2026-11-27.md`.

**How to use this file.** Start a new Claude Code session at the repo root and
paste this whole file as the first message. Then read: `CLAUDE.md` §1–4, §6a
("The chokepoint locator map" and "The Mancalë map"), §9, §11, §13;
`DESIGN-RUBRIC.md`; `DECISIONS.md`; and the **merged Part 1 code**
(`src/lib/live/vessels.ts`, `src/lib/live/registry/`, `src/app/vessels.json/route.ts`,
the changes to `src/lib/live/sources/ais.ts`). Also read, in `src/`:
`components/chokepoint-map-base.tsx`, `components/chokepoint-map.tsx`,
`components/mancale/mancale-map.tsx`, `components/live/reading-block.tsx`,
`components/live/place-board.tsx`, `components/live/auto-refresh.tsx`,
`app/monitor/page.tsx`, `lib/monitor.ts`, `lib/live/nodes.ts`, `lib/places.ts`.
`CLAUDE.md` ends with a warning that this is **not the Next.js you know** (Next 16):
read the relevant guide in `node_modules/next/dist/docs/` before writing route,
caching or client/server component code.

**If this file and the repo disagree, the repo and `CLAUDE.md` win.** Where Part 1
as merged differs from what this file assumes, follow Part 1's code and say so in
your report.

---

## 0. Prerequisites. Check these first; stop and report if the first is unmet

1. **Part 1 is merged to `main`.** Without its `VesselRecord` data and server
   accessor there is nothing to draw. If it is not merged, stop and say so. Do not
   re-implement it.
2. If Part 1's server code exposes vessels **only** through the `/vessels.json`
   route, add a small server-side accessor next to it (same sample, no second socket,
   no HTTP call to your own route) and say so. Do not open a second AIS connection;
   AISStream allows three per account.
3. Real AISStream message fields were meant to be confirmed by Alex's capture.
   If they have not been, build against the fixtures and **say plainly in the PR
   that nothing has been seen on live data.** Expect most ships to show "type not
   heard" until the registry fills; the page must be honest about that.

Not prerequisites for **building** (the work stays behind `monitorEnabled = false`),
but required before anything goes public: both founders agreeing in `DECISIONS.md`
to show per-ship data, and an answer from AISStream on commercial use. Do not flip
`monitorEnabled`.

## 1. What Gavin wants, and why

Gavin wants an AIS-style view on novusdata.news: ships on a map, filterable. He
asked for filtering by **cargo and company**. Neither exists in free AIS data
(AIS has a coarse ship type, no cargo and no owner), so Part 2 delivers filtering by
**ship type, flag (from MMSI), under-way status and name/MMSI search**. Company
filtering is Part 3, and only for carriers whose fleet lists Novus has sourced.

What makes this more than another tracker is the join to the register: next to each
chokepoint, the open register entries that name it, with their status and a link.
Plain tracking maps are free elsewhere (MarineTraffic, VesselFinder). The register is
Novus's own.

## 2. Scope

**In:** coastline detail good enough to zoom to a chokepoint; one map panel per
chokepoint with ships drawn as shapes; filters; a details card; an accessible table
alternative; register link per place; honest empty, partial and failed states;
tests; docs; a draft pull request.

**Out (do not build, stub or hint at):** planes; carrier or company filtering; cargo
anything; ship trails or history; heading arrows; destination or ETA; per-ship
pages; map tiles or any map library; WebSockets to the browser; URL-synced filter
state; the `monitorEnabled` flip; Part 3.

## 3. The one hard technical fact: the existing coastline is too coarse

`src/components/world-land.ts` is Natural Earth **1:50m**, simplified for a
1000-unit-wide frame covering 245 degrees of longitude (about 0.25 degree per
unit). A chokepoint box is about 1 degree wide (Hormuz box: 1.4 by 1.1 degrees), so
at that resolution the whole box is roughly 5 units across. **Zooming the existing
path into a panel would be an unreadable blob.** Part 2 therefore needs a new,
finer land source:

- Write `scripts/build-chokepoint-land.ts`, modelled on `scripts/build-map-land.ts`
  (read it first). It takes a path to Natural Earth's **1:10m** land GeoJSON
  (`ne_10m_land.geojson`, public domain; same Rule 3 basis as the existing file;
  source `https://github.com/nvkelso/natural-earth-vector`, folder `geojson/`).
  The GeoJSON is **not committed**.
- For each of the 10 chokepoints in `src/lib/live/nodes.ts`, compute a view window
  (box padded by about 35 percent per side), clip the land to it, simplify
  (Douglas-Peucker, about a third of a pixel at the panel's size) and emit one SVG
  path per place into a generated file `src/components/chokepoint-land.ts` with a
  header saying it is generated, from what, under what terms, and how to rebuild.
  Do not hand-edit it.
- **Projection:** equirectangular with the x axis scaled by `cos(mid-latitude)` of
  the window, so Dover (51 degrees north) is not stretched. One pure module
  `src/lib/live/panel-geo.ts` holds the window computation and
  `project(lat, lon)` for both the build script and the components, so ships and
  coastline cannot drift apart. Unit-test it.
- **Size budget:** the generated file should stay under about 150 KB. Measure it
  and report. If it is over, raise the simplification tolerance; do not drop a place.
- If the sandbox cannot download the GeoJSON (outbound access is allowlisted), say
  so and ask Gavin to download that single file and attach it. Do not substitute
  another dataset without the Rule 3 check.

## 4. Deliverables

### P1. Panels: `src/components/live/ships-panel.tsx`
One card per chokepoint, in the site's story-box grammar (read `story-box.tsx` and
how `place-board.tsx` uses kickers and hairlines). Each card:
- the finer coastline from section 3, the sampling box drawn as a thin dashed
  outline labelled "sampling area" so nobody reads the edge as the edge of the
  strait;
- ships as small shapes (below), plotted with the shared `project()`;
- a one-line summary computed from data: "N heard, M under way; type known for K."
  Never an invented figure; when the sample was empty, say "No signal in this
  sample" (the existing wording in `ChokepointTable`) and add that a zero is not an
  empty sea;
- the coverage note from `node.note` where one exists;
- the open register entries naming this place (see P4).

Layout: a responsive grid of the ten cards under shared filters (P2), so a reader
can ask "where are the tankers" across all ten at once. Server-render the card
frame, summary and tables; the interactive layer is one client component (P2).

### P2. Filters and details: one client island, `src/components/live/ships-explorer.tsx`
`'use client'`. No new dependency, no map library, plain SVG.
- Controls: **Type** (all, cargo, tanker, passenger, fishing, tug-special,
  high-speed, sailing-pleasure, military, other, unknown; single select or chips, your
  call, but keyboard-operable); **Under way only** (toggle; under way means the
  existing rule, speed of at least 1 knot, with 102.3 treated as unavailable);
  **Flag (from MMSI)** (select built from flags actually present, "All flags"
  first; labelled exactly "Flag (from MMSI)" everywhere); **Search** by name or MMSI
  (case-insensitive substring; plain text only).
- Put the filtering logic in a **pure function** `filterVessels(vessels, filters)` in
  `src/lib/live/vessel-filter.ts` (client-safe, no side effects) so it can be tested
  without a browser.
- Each card shows "X shown of Y heard" and the cards update together.
- **Details card** on selecting a dot or a table row: name (or "Name not heard"),
  MMSI, flag (from MMSI), type (category word, plus how it is known: "reported by
  the ship in this sample", "from earlier reports, last heard {absolute UTC date}", or
  "not heard"), under way or not with speed in knots, course if reported, and the
  time the position was last heard as an absolute UTC time. **Nothing else.** No
  company, cargo, destination, owner or trail.
- Data into the island: compact objects (id, name, category, flag, underway, speed,
  course, rounded lat/lon, seenAt, typeSource). **Payload budget: keep the
  serialised vessel props under about 250 KB uncompressed at the 2,000-vessel cap;
  measure and report the real number.** If over, trim fields, not ships.
- The page already refreshes itself (`auto-refresh.tsx` calls `router.refresh()`
  every 5 minutes). Filter state must survive that, and a selected ship that is no
  longer in the new sample must clear gracefully, never crash.
- Progressive enhancement: with JavaScript off the page still shows the per-card
  summary and the counts-by-type table (P3).

### P3. Shapes, key and accessibility
- **Meaning is carried by shape, never by colour alone** (CLAUDE.md §6a: "a status
  colour never appears without its word"; DESIGN-RUBRIC C2 and D2). One ink colour
  for every ship (`--accent-text`); category by shape: circle (cargo), square
  (tanker), triangle (passenger), diamond (fishing), plus sign (tug-special), a
  hollow ring (type not heard), small cross (other). High-speed, sailing-pleasure
  and military may share "other" shape unless you can make them distinct; say what
  you chose.
- **Never use the register status colours** (`--status-active` etc.) on ships. They
  mean register status and nothing else; that confusion is exactly what §6a warns
  about for the two existing maps.
- Not under way = smaller and lighter. A key beside the filters shows each shape
  with its word, plus the not-under-way convention, and the sampling-area outline.
- Check in greyscale. Every shape must be distinguishable at 390 px wide.
- An `<svg role="img">` hides its content from assistive technology (noted in §6a),
  so the dots are **decorative** (`aria-hidden`) and the information is in real HTML:
  a **counts-by-type table** per card (always visible, server-rendered) and a
  **ship table** per card inside a `<details>` ("All N heard"), with the same
  filters applied, showing at most the first 100 rows (under way first, then
  MMSI) and stating how many are not listed. Table rows select a ship exactly as a
  dot does. Tap targets at least 44 px in the table; axe-core target-size already
  failed once on `/mancale` (DECISIONS.md), so check it here.

### P4. Register link, at the place level only
- Under each card, list the open register entries whose `places` include that
  chokepoint id, each with its status word (via `StatusBadge`) and a link, reusing
  `registerByPlace` from `readMonitor()` (`src/lib/monitor.ts`) and the pattern in
  `place-board.tsx`. If there are none, say "No open register entry names this
  place." Do not hide the card.
- **Never connect a ship to a company**, not by proximity, name or anything else.
  `nodes.ts` says why: a place is a geographic statement; a company is an exposure
  claim that needs a mechanism, confidence, date and source. The join is
  place to register entry, nothing finer.

### P5. Page wiring: `src/app/monitor/page.tsx`
- Add a section "Ships at the chokepoints" (`id="ships"`) directly after the existing
  Chokepoints table, which **stays** (its counts and its "rows are not comparable"
  caution are still true). The section renders inside `ReadingBlock` so the three
  Reading states are handled for free: `unavailable` says why, `not-configured`
  says the source is not switched on, `ok` shows the panels with the source and
  as-of time.
- No new route, no nav change, no sitemap change. The section sits behind the page's
  existing `monitorEnabled` gate. `revalidate = 900` stays a literal.
- Section intro (house style: plain, understated, **British spelling**, no hype):
  must say that ships are drawn from their own radio reports, that coverage comes
  from receivers near the coast, that a ship may not appear, and that the picture
  shows traffic, not cargo.

### P6. Copy that must appear (write it in the site's voice; do not weaken it)
1. Ships report their own position, speed and type. It is not checked, and positions
   can be wrong or deliberately falsified (GPS interference is documented in the
   Gulf and Red Sea). Say "reported by the ship".
2. Coverage is from receivers on land. Offshore it is thin. A zero or a gap means no
   signal received, not no ship.
3. Ships that are not under way broadcast far less often, so they are
   under-represented.
4. Type is the ship's own broadcast category. **It says nothing about what it is
   carrying.** A cargo-type ship may be empty; never write "carrying".
5. Flag is derived from the first digits of the ship's identifier and usually, but
   not always, matches the country it is registered in.
6. How many ships had a known type (computed, never invented), and that this
   improves as the registry fills.
7. The picture is one short sample (30 seconds at last count), taken about every 15
   minutes, so ships move between samples.

### P7. Names and sensitive ships (proposed defaults; flag as the founders' call)
Ship names are text typed by crews: render as plain text only, never as HTML, never
into a URL or `href`. Proposed default: **do not show the name** of a ship whose
type code is 35 (military) or 55 (law enforcement); show the shape and "name not
shown" in the details card. Say in the PR that this is a default awaiting the
founders' decision.

### P8. Tests, added to `test:regressions` as plain `tsx` scripts
`scripts/tests/ships-panel.ts`: `panel-geo` (a point inside a box lands inside its
viewBox for every one of the 10 chokepoints; cos-latitude scaling; round trip on a
known coordinate); `filterVessels` (each filter alone and combined; empty result;
search with regex metacharacters treated as plain text; name containing `<script>`
stays text); server-render the panels with `react-dom/server` against fixtures and
assert: no company name appears anywhere in the output, no status class on any ship,
every shape has its word in the key, an empty box prints "No signal in this sample",
and an `unavailable` reading renders its reason and no ships. Add a bundle check that
fails if the serialised island props exceed the budget at the 2,000-vessel cap.

### P9. Docs
- `CLAUDE.md`: add a subsection under §6a ("The ships panel") recording: the finer
  coastline and why, shapes-not-colour, no status colours, place-to-register only,
  the copy rules in P6, the names default in P7. Update the §6d section Part 1 added.
- `DECISIONS.md`: extend Part 1's **draft, unapproved** entry with what Part 2 adds
  and the founders' open questions (section 6). Do not mark anything agreed.
- Record the payload sizes and the generated land file size in the PR, not in code.

## 5. Order of work

1. Prerequisites (section 0). Read Part 1's merged code.
2. `panel-geo.ts` and its tests.
3. `build-chokepoint-land.ts`; get the 1:10m file; generate; measure size; look at
   Hormuz, Dover and Panama specifically (narrow waters are where a coarse source
   fails first).
4. `filterVessels` and its tests, then the explorer, then the server panels.
5. Wire the section into `/monitor`; run against `CONTENT_SOURCE=fixtures`
   (`npm run dev:demo`) with `monitorEnabled` temporarily true **locally only**.
6. `npm run check`, `npm run test:regressions`, `npm run build` (strict).
7. Look at it: 390, 820 and 1180 px, keyboard-only, JavaScript off. Run axe-core
   without adding it to `package.json` (for example `npx`, one-off; Rule 4 forbids
   adding a dependency). If you cannot run a browser, **say so; do not claim visual
   checks you did not do.**
8. Score the page against `DESIGN-RUBRIC.md` (gates G1-G5 plus the dimensions that
   apply); put the totals in the PR and say who scored. Revert the flag; confirm
   `git diff` shows `launch.ts` untouched.

## 6. Decisions that are not yours (surface them in the PR)

- Whether to show per-ship data publicly at all (needs both founders; DECISIONS.md).
- Whether names are shown, and the military/law-enforcement default in P7.
- Whether AISStream's lack of stated terms and uptime guarantee is acceptable for a
  site that may later charge. Gavin or Alex should email them.
- Whether this lives on `/monitor` (as built) or earns its own page and nav entry
  later.

## 7. Calls made in this handoff (check them)

1. Finer land from Natural Earth 1:10m, generated per place, not a map library.
2. One client island; everything else server-rendered and readable without script.
3. Shapes carry meaning; one ink colour; no status colours on ships.
4. Section on `/monitor`, after the Chokepoints table, which stays.
5. Dots are decorative; tables are the accessible equivalent.
6. Filters are type, under way, flag (from MMSI) and search. No cargo or company filter.
7. Military and law-enforcement names withheld by default.
8. Payload budget about 250 KB for the island props; land file about 150 KB.

## 8. Acceptance criteria (all must hold)

- [ ] `npm run check`, `npm run test:regressions`, `npm run build` pass.
- [ ] `monitorEnabled` is still `false`; `launch.ts` is untouched in the diff.
- [ ] No new dependency (`package.json` and `package-lock.json` unchanged).
- [ ] The new land file is generated, cites its source and terms, and is under the
      size budget or the overage is reported.
- [ ] With fixtures and the flag on locally: ten panels render; filters change the
      counts; a selected ship's card shows only the permitted fields; JavaScript off
      still shows summaries and the counts table.
- [ ] No company name, cargo claim, destination or trail appears anywhere. The
      render test proves the first.
- [ ] No status colour on any ship; shapes distinguishable in greyscale at 390 px.
- [ ] The three Reading states render correctly; an empty box says "No signal in this
      sample".
- [ ] Every number on the page is computed from the sample (counts, known-type
      count); none is typed in.
- [ ] The P6 copy is present. Ship names render as text only.
- [ ] The PR reports measured payload and file sizes, rubric totals, what was checked
      visually and what was not, and what has not been seen on live AIS data.

## 9. Reporting back and the pull request

- Branch `claude/vessels-part-2`, branched from `main` after Part 1 merged. **Draft
  PR** against `main`; do not merge or push to `main`; do not change repository,
  Vercel, Supabase or AISStream settings. If you cannot push, produce a patch.
- Gavin prefers results-first, plain language. Open the PR description and your final
  message with three plain lines: what now exists, what is still switched off, what
  Alex must decide or do next. Technical detail below that.
- List the calls in section 7, anything unverified, and any conflict between this file
  and the repo.
- Do not tell Gavin it "works" on live data unless live data was seen.
