# Novus Data — Vessel layer, Part 3 (carriers and planes): Claude Code handoff

Written 27 Nov 2026 for a fresh Claude Code session in `novus-data/novus-data`
(repo read at `main` commit `951df0c`; Parts 1 and 2 were **not yet merged** when
this was written). Part 3 of 3. Companions: Part 1
(`claude/82-Vessel-Layer-Part-1-Claude-Code-Handoff-2026-11-27.md`) and Part 2
(`claude/85-Vessel-Layer-Part-2-Claude-Code-Handoff-2026-11-27.md`).

**How to use this file.** Start a new Claude Code session at the repo root and
paste this whole file as the first message. Then read: `CLAUDE.md` §1–4 (especially
Rules 1, 2, 3, 4, 5 and 7), §6a (the register, its four-part standard of proof, and
the two maps), §11, §13, §14a; `DESIGN-RUBRIC.md`; `DECISIONS.md`; the **merged
Part 1 and Part 2 code** (`src/lib/live/vessels.ts`, `src/lib/live/registry/`,
`src/lib/live/vessel-filter.ts`, `src/lib/live/panel-geo.ts`,
`src/components/live/ships-panel.tsx`, `ships-explorer.tsx`); and the pattern this
work copies: `src/lib/disruptions/` (`types.ts`, `sources/local-files.ts`, the
index), plus `src/lib/live/types.ts`, `src/lib/live/nodes.ts`,
`src/lib/live/sources/index.ts`, `sources/ais.ts` and `sources/fixtures.ts`.
`CLAUDE.md` ends with a warning that this is **not the Next.js you know** (Next 16):
read the relevant guide in `node_modules/next/dist/docs/` before writing route,
caching or client/server component code.

**If this file and the repo disagree, the repo and `CLAUDE.md` win.** Where Parts 1
or 2 as merged differ from what this file assumes, follow their code and say so.

---

## 0. Prerequisites. Check these first; stop and report if (1) is unmet

1. **Parts 1 and 2 are merged to `main`.** Part 3 adds a field to Part 1's
   `VesselRecord` and a filter and a line in the details card to Part 2's explorer.
   If either is missing, stop and say so. Do not re-implement them.
2. Check whether the registry (`VESSEL_STORE=supabase`) is switched on anywhere.
   Carrier matching needs a ship's **IMO number**, and a ship's IMO arrives only in
   its **static** message, which Class A ships send about every six minutes and our
   sample listens for 30 seconds. Without the registry, matches will be near zero.
   That is expected; see section 1. Do not "fix" it by guessing IMO numbers or by
   matching on names.
3. Part 3 has two halves with different gates. **3A (carriers)** can be built and
   reviewed on its own. **3B (planes)** depends on a free OpenSky account that Alex
   creates, and on terms that are not settled (section 5, A0, and section 7). Build 3A first, open its
   PR, then do 3B in a **second PR** if time allows. Say plainly which you finished.

Nothing here is a prerequisite for **building** (the work stays behind
`monitorEnabled = false`). It is a prerequisite for anything **public** that both
founders agree in `DECISIONS.md`. Do not flip `monitorEnabled`.

## 1. What Gavin wants, and the honest version of it

Gavin asked for an AIS-style map you can filter by **cargo and company**, and for
planes and trucks too. Part 2 delivered ships filtered by type, flag, under way and
search. Part 3 closes as much of the remaining gap as free data allows:

| Wanted | What Part 3 can honestly do |
|---|---|
| Filter ships by **company** | Only for carriers whose **own published fleet list** Novus has loaded, matched by the **IMO number the ship broadcasts**. Every match shows the carrier's wording, list date and source link. Unmatched ships are "no match in the lists we hold", never "independent" |
| Filter ships by **cargo** | **No.** Not here, not later, from AIS. A carrier match says whose fleet list the IMO appears in, not what the ship carries (a liner carries other firms' cargo) |
| **Planes** | OpenSky position data near a few air-cargo hubs. No operator field exists; an airline can be **inferred** from the callsign's three-letter prefix using the FAA's public designator table. Planes carry belly cargo and cargo airlines fly empty, so cargo is again not claimed |
| **Trucks** | **No.** No public live source exists. Do not build, stub or mention |

**Expectations to state, not hide.** Carrier matches will be a small fraction of the
ships heard, and zero until the registry has run for days. Part 3A is mostly worth
having for **credibility**: a visible table of exactly which fleet lists Novus holds,
how old they are and where they came from, is the same standard of proof as the
register, applied to ships. It is not a volume feature. Planes are the lowest-value
piece of the three parts. Say so in the PR; Gavin prefers a straight answer to a
flattering one.

## 2. Scope

**In (3A):** a sourced carrier table with load-time validation; an import script that
turns a file a person saved from a carrier's own page into a validated record; IMO
check-digit validation; matching by IMO only; one new filter ("Carrier") and one new
line in Part 2's details card; a transparency table of the lists held; tests; docs.

**In (3B):** air nodes (a few airport boxes), an OpenSky source, aircraft records
with a coarse category and a callsign-prefix operator inference from a small sourced
table, a section on `/monitor` that is mostly counts and tables, fixtures, tests,
docs.

**Out (do not build, stub or hint at):** cargo anything; trucks; ship-to-register
joins by company (section 4, C6); name-based or fuzzy matching of any kind; scraping
or crawling carrier sites from code; ship or aircraft trails, history or storage of
positions; destination, ETA, schedules; ownership-graph or sanctions features; any
`monitorEnabled` flip; per-aircraft or per-ship pages; a new route or nav entry.

## 3. Rules that bind this work (read the originals in `CLAUDE.md`)

- **Rule 1, no fabricated data.** Never invent an IMO number, a carrier, a
  designator or a relationship. **You cannot fetch carrier fleet lists from this
  sandbox and you must not recall them from memory.** Part 3A ships the machinery
  with **no real carrier records**; the records are loaded by a person from the
  carrier's own page (section 4, C4). A fixture carrier is allowed and is marked
  `[SAMPLE]` and excluded from production output.
- **Rule 2, no implied organisation.** Nothing here implies Novus has a research
  desk or a partnership with any carrier. Do not use carrier logos or marks (Rule 3,
  "no copyrighted logos, marks").
- **Rule 3, no unlicensed third-party data.** A fleet list is the carrier's own
  published statement; record the page, the publisher, the retrieval date and a
  note that its terms were read and permit this use. If the page's terms forbid
  copying or automated use, that carrier is **not loaded**. Embedded tables (the
  designator table) must cite a public source and retrieval date. Do not use
  Wikipedia fleet lists, MarineTraffic, VesselFinder, Lloyd's List, MagicPort or any
  commercial vessel database as a source.
- **Rule 4, ask before installing.** No new dependency.
- **Rule 5, no secrets in the repo.** OpenSky credentials are server-only
  environment variables; the build must refuse a `NEXT_PUBLIC_` copy exactly as it
  does for the AIS key (find that check and mirror it).
- **Rule 7, do not touch external accounts.** Do not log into OpenSky, Vercel,
  Supabase or GitHub settings. Anything needing an account becomes numbered steps in
  `DEPLOY.md` for Alex.
- **Standard of proof (§6a, §14a).** A claim about a named company needs a
  mechanism, a confidence, a date and a source. A carrier match is a **narrow
  factual claim** ("this IMO appears in this carrier's published list, dated X") and
  must be worded as exactly that, with its date and link. It is **not** an exposure
  claim and must never read as one.
- **Places, not companies (`nodes.ts`).** The live layer measures geography; the
  register makes company claims. Part 3 adds a company-bearing field to ships, so the
  separation matters more, not less. See C6.
- **The live layer's one rule.** Age comes from a timestamp inside the upstream data,
  never from when our code ran. A failed reading carries no data and no stale
  placeholder.
- **Understatement passes; overstatement fails.** Every caveat on the existing pages
  still applies, and Part 3 adds more (section 4, C5).

## 4. Deliverables, 3A: carriers

### C1. Types and the pure IMO check: `src/lib/carriers/types.ts`
Client-safe, no network, no `node:fs`.
- `CarrierRecord`: `id` (slug), `name` (exactly as the source writes it; **never
  shorten or merge** two companies that share a brand, for example a group and a
  separate company that uses the same name), `kind` (`'shipping-line' | 'air-operator'`),
  `relationship` (an enumerated word taken **from the source's own wording**:
  `'owned' | 'operated' | 'managed' | 'chartered-in' | 'listed'`; use `'listed'`
  when the source does not say), `sourceLabel` (the heading or label on the page where
  the list sits, so a reader can find it; a few words, not a long quotation),
  `asOf` (date the list was true or published, `YYYY-MM-DD`), `retrieved`
  (`YYYY-MM-DD`), `sources` (at least one `{ url, publisher }`, http(s) only),
  `termsChecked` (`{ on: 'YYYY-MM-DD', note: string }`), and either `imo: number[]`
  (ships) or `designators: string[]` (airlines; three upper-case letters).
- `isValidImo(n)`: seven digits; the check digit is the last digit of the sum of the
  first six digits multiplied by 7, 6, 5, 4, 3, 2. Worked example to put in the
  test: **9074729** passes (9×7 + 0×6 + 7×5 + 4×4 + 7×3 + 2×2 = 139, last digit 9)
  and **9074720** fails. Cite the IMO scheme in a comment. This guards against typos
  in imported lists and against junk in broadcast IMO fields; it does **not** prove a
  ship is who it says it is.
- Staleness: a `STALE_AFTER_DAYS` constant for fleet lists. **Proposed default: 90**
  (fleets change slowly but newbuilds and sales happen). It is a proposal; flag it for
  the founders. As with disruptions (§6a), never print a live-sounding day count: print
  the absolute `asOf` date and phrase any warning against the build.

### C2. Loader: `src/lib/carriers/sources/local-files.ts`, index `src/lib/carriers/index.ts`
Copy the structure and, importantly, the **enforcement stance** of
`src/lib/disruptions/sources/local-files.ts`: files in `content/carriers/*.json`;
an entry missing any required field, with a source that is not a followable http(s)
URL, with a future `asOf`, or with no `termsChecked`, is **dropped with a warning
naming the file**, never half-rendered. An individual IMO that fails `isValidImo` is
dropped with a warning and a count; the rest of the record stands. Duplicate IMOs
within one record are collapsed. The same IMO in **two** carriers' lists is allowed
(an owner and an operator may both list a ship) and both matches are kept.
Pages import from `@/lib/carriers` (the index), not from `sources/*`; add the lint
boundary the same way `eslint.config.mjs` does for disruptions. Components import
types and labels from `@/lib/carriers/types`, not the index (§6a explains why).

### C3. Matching: pure `matchCarriers(imo, carriers)` in `src/lib/carriers/match.ts`
- **IMO only.** No matching by ship name, MMSI-prefix, name prefix ("Maersk ..." says
  nothing about who owns or operates a ship; many ships carrying a line's name are
  chartered or lease-owned), callsign, flag or proximity. A test must prove that a
  ship named like a carrier but with no matching IMO gets no match.
- Input is the IMO the ship broadcast (from Part 1's static data or registry). It
  must pass `isValidImo` first; an invalid or zero IMO matches nothing and counts as
  "no IMO heard".
- Output: zero or more matches, each `{ carrierId, relationship, asOf, stale }`.
- Matching runs on the server. If Part 1's `VesselRecord` does not carry the IMO,
  join it from `VesselStatic` there; **do not add the raw IMO to the client island
  props** (Part 2's budget and field list stay as they are; only `carrierIds` is new).
- Extend Part 1's `VesselRecord` with `carrierIds: string[]` (empty when none) and
  add the match to `/vessels.json`, keeping that feed's shape otherwise unchanged.
  Do not touch `/live.json`.

### C4. Getting real data in: `scripts/import-fleet.ts` (no network)
Claude Code cannot and must not fetch or recall fleet lists. The script reads a **CSV
or JSON file a person saved from the carrier's own published page**, validates it,
and writes a skeleton `content/carriers/<id>.json`:
- Requires, as flags, `--id --name --relationship --source-url --publisher
  --retrieved --as-of --source-label --terms-note`; refuses without every one.
- Reads one column named `imo`; reports how many rows, how many valid, how many
  invalid (printing the invalid values so the person can fix the source file or
  correct a typo), and how many duplicates.
- Never overwrites an existing record without `--replace`; never makes a network
  call; prints nothing but counts and the output path.
- Add `npm run carriers:import -- ...` to `package.json` scripts (no dependency).
- Write the **procedure for Gavin and Alex** into `DEPLOY.md` (new short part
  "Loading a carrier's fleet list"): open the carrier's own fleet page; read its
  terms for anything that forbids copying or automated use (if it does, stop: do not
  load that carrier); save the list; run the script; open the generated file and read
  it against the page; commit through a normal pull request so the diff is reviewed.
  Start with **three to five carriers at most**, each from its own page, and expect
  that some carriers publish no IMO-level list at all (in which case they are simply
  not in the table). One lead to verify, not a fact to rely on: a separate tanker
  company, Maersk Tankers, has a public "ships" page with an IMO column. It is a
  different company from the container line that shares the Maersk name; the two
  must be recorded under their own exact names or not at all.

### C5. UI: additions to Part 2's explorer, nothing else
- **Filter: "Carrier (from published fleet lists)".** A select built only from
  carriers that matched at least one ship in the current sample, plus "All" and "No
  match in the lists we hold". If **no** carrier matched, **do not show the control**;
  show the line "No heard ship matched a fleet list we hold" and the transparency
  table below. Filter logic goes into Part 2's pure `filterVessels` and is tested.
- **Summary line per card**, computed: "K of N heard matched to a listed fleet; the
  rest are unmatched, not unaffiliated." Never an invented figure.
- **Details card**, only when matched, one extra block: "Reports an IMO number that
  appears in {carrier name}'s published fleet list ({relationship} wording; list
  dated {absolute date}; source: {publisher link})." Use "reports", because the
  IMO is typed into the transponder by the crew, can be wrong, and has been
  deliberately falsified by some vessels. Add a stale note when the list is older
  than `STALE_AFTER_DAYS` at build time ("had not been refreshed when this page was
  built"). Still **no cargo, destination, owner (as a claim) or trail**.
- **Transparency table**, always visible when the section renders, inside a
  `<details>` if long: one row per carrier loaded: name, relationship wording, list
  date, number of IMO entries, source link. This is the point of 3A. If none are
  loaded, the section says: "Novus has not loaded any carrier fleet lists yet."
- Shapes, colours and accessibility rules from Part 2 (P3) are unchanged. **A carrier
  never gets its own colour or logo.** One ink colour; the carrier appears as words.
- Payload: carriers travel as a small id-to-name map plus `carrierIds` on each ship.
  Re-measure Part 2's serialised-props budget and report the real numbers.
- Copy that must appear, in the site's voice, British spelling, not weakened:
  1. A match means a ship's broadcast IMO number appears in the carrier's own list.
     It does not show who is carrying what, and a line carries other firms' cargo.
  2. The IMO is typed in by the crew; it can be wrong or falsified.
  3. We hold lists for only the carriers shown below. A ship with no match may belong
     to any carrier, or to none we have loaded.
  4. Lists change; each shows its own date.
  5. A carrier's presence at a place is not a statement that the carrier is affected
     by anything happening there.

### C6. The line this part must not cross: no ship-to-register join by company
Part 2 joins ships to the register **by place**. Part 3 must not extend that to
**company**. Do not look up register entries by carrier name; do not show a register
status next to a carrier; do not add "also in the register" links from a matched
ship. "Carrier X has a ship in the Strait of Hormuz **and** Carrier X appears in a
register entry about Hormuz" reads as an exposure claim that nobody has checked
against a mechanism. That join is a **founders' decision** (section 7) and, if ever
made, goes through a register entry with its four required fields, not through code.

### C7. Tests: `scripts/tests/carriers.ts`, added to `test:regressions`
`isValidImo` (the worked pass and fail cases, wrong length, non-numeric, zero);
loader drops (missing source, non-http URL, future date, missing `termsChecked`,
missing relationship, bad IMO dropped while record stands, duplicate IMOs, same IMO in
two carriers); `matchCarriers` (match; no match; name-lookalike with no IMO gets
nothing; invalid IMO gets nothing; two matches kept); `filterVessels` with the
carrier filter (alone, combined, "no match" option, regex characters in search still
plain text); a server render with `react-dom/server` asserting: a carrier name appears
**only** for matched ships and in the transparency table, never in a card without a
match, never next to a status colour, never alongside the word "carrying" or a cargo
claim; the empty state text prints when no carrier is loaded; the stale note appears
for an old list; `[SAMPLE]` carriers are absent from production-mode output;
`import-fleet` refuses without every flag and reports counts correctly on a fixture
file. A fixture carrier lives in the fixtures path, not in `content/carriers/`.

## 5. Deliverables, 3B: planes (second PR; lower priority)

### A0. Gate and expectations
OpenSky's own API documentation describes the API as for **research and
non-commercial purposes** and asks commercial users to contact them; its published
data licence lists non-profit research, non-profit education, commercial
**internal testing and evaluation**, and government purposes. Novus may charge
(Free / Professional / Enterprise). **Showing OpenSky data on a public, possibly
paid product is not clearly permitted.** So 3B is built hidden, uses no OpenSky call
unless credentials are configured, and **must not go public** until both founders
have OpenSky's written answer recorded in `DECISIONS.md`. State this in the PR's
first lines. Do not assert the terms are fine.

### A1. Air nodes: `src/lib/live/air-nodes.ts`
A short list of **airports as places** (never airlines): propose **eight** air-cargo
hubs, each `{ id, name, iata, lat, lon, box }` with a roughly 0.8 by 0.8 degree box.
Candidates to evaluate, not facts: Memphis, Louisville, Anchorage, Hong Kong,
Shanghai Pudong, Leipzig/Halle, Cologne/Bonn, Dubai. Take coordinates from a **citable
public source** (OurAirports data is public domain) and record the URL and retrieval
date in the file header. If you cannot source a coordinate, leave that airport out.
Same header discipline as `nodes.ts`: approximate, accurate to a few kilometres, named
by place. Each box must be 25 square degrees or less so one query costs one credit
(section A2). Receiver coverage is uneven worldwide; add a `note` per node where you
can source one, and otherwise say nothing rather than guess.

### A2. Source: `src/lib/live/sources/opensky.ts`
Facts read from OpenSky's REST documentation on 27 Nov 2026 (re-check them; if the
live docs differ, the docs win and you say so):
- `GET /states/all` takes `lamin`, `lomin`, `lamax`, `lomax` (all four together).
  Each state vector is an array: index 0 icao24, 1 callsign, 2 origin_country,
  3 time_position, 4 last_contact, 5 longitude, 6 latitude, 7 baro_altitude,
  8 on_ground, 9 velocity (m/s), 10 true_track, 11 vertical_rate, 12 sensors,
  13 geo_altitude, 14 squawk, 15 spi, 16 position_source, 17 category (the category
  appears only with the extended option; confirm the parameter name in the docs).
- **Authentication is OAuth2 client credentials only; basic authentication no longer
  works.** Tokens expire after 30 minutes; a 401 means fetch a new token. Confirm the
  token endpoint URL in the docs (believed to be on `auth.opensky-network.org`;
  unverified here). Credentials are `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`,
  server-only, empty in `.env.example`.
- Credits are per bucket per day: anonymous 400, standard free account 4,000. A
  query over a box of 25 square degrees or less costs 1 credit. Eight boxes is eight
  credits per regeneration; at `revalidate = 900` that is up to 96 regenerations a
  day, so about 770 credits a day for one route, **more than the anonymous allowance**,
  so a free **registered** account is required. Every `next build` and every
  deployment preview that renders the page also spends credits; count them and say so
  in the PR. A 429 means out of credits: return an `unavailable` Reading that says
  so, and do not retry in a loop.
- `states` can be `null` (an empty sky is not an error); position fields are often
  `null` and such records are dropped and counted; `time_position` can be `null`
  (use `last_contact`, and say which). Age comes from those timestamps.
- One token request per regeneration, one query per box, run **sequentially or with a
  small limit**, never a burst. Total time must fit `maxDuration = 60` with the AIS
  listen; measure and report. If it does not fit, say what you cut.
- Same isolation rule as `settle`: an OpenSky failure never fails the snapshot; the
  credentials never appear in any Reading, error, log or output (canary-secret test).
- Fixtures through the real parser (`CONTENT_SOURCE=fixtures`), with strings marked
  `[SAMPLE]`. Choose fixture `icao24` values from a block ICAO's allocation
  document marks **unallocated** and cite it; if you cannot, say so in the PR and use
  the least collision-prone option you can defend.

### A3. Aircraft records and the operator inference: `src/lib/live/air.ts` (pure, client-safe)
- `AircraftSighting` and a coarse `aircraftCategory` from the OpenSky category code
  (light, small, large, heavy, rotorcraft, other, unknown). **Verify the code table
  against the docs before embedding it**; if the docs page does not list it, embed
  nothing and use `unknown`, per Rule 3.
- `callsignDesignator(callsign)`: sanitise (control characters, padding, 8-character
  cap); return the first three letters **only when** the callsign is three letters
  followed by a digit (the usual commercial pattern). Registrations and other forms
  return `null`.
- **Operator table**, `content/carriers/` entries of `kind: 'air-operator'`, loaded by
  the same loader (C2). Each maps one or more three-letter designators to the
  operator's name and cites the **FAA Order JO 7340.2** (Contractions), Chapter 3,
  which lists civil aircraft company, telephony and three-letter designators and is a
  US government document. Cite the exact **edition and retrieval date** (the FAA site
  showed more than one edition in circulation on 27 Nov 2026, so confirm which is
  current). Start with a **handful of well-known air-cargo operators that the founders
  approve**, taken from that document by name, not from memory. Examples of designators
  to look up and confirm, not facts to trust: FedEx, UPS, Atlas Air, Cargolux.
- **Wording is inference, not identification:** "Callsign begins with {XYZ}, the
  designator the FAA lists for {operator}." Add that aircraft are sometimes flown for
  one operator under another's designator (leased aircraft and feeder flying), that
  passenger airlines also carry freight, and that cargo operators also fly empty. Never
  "carrying", never a cargo claim.

### A4. Privacy and sensitivity defaults (proposed; flag as the founders' call)
Aircraft identifiers can point at a private owner, and Rule 3's photo list excludes
identifiable private individuals; apply the same instinct here. **Default: show
per-aircraft callsign and icao24 only when the callsign matched an approved operator
designator.** Everything else appears as
anonymous counts by category, never an identifier. Do not show military-looking
aircraft individually if you can identify them from the category or squawk without
guessing; otherwise aggregate. No icao24-to-registration lookups. No history.

### A5. Page: `src/app/monitor/page.tsx`, section `id="air"` after the ships section
Inside `ReadingBlock` (three Reading states for free). Per air node: counts by
category (on the ground, airborne), a small table of matched operator flights, the
coverage note, and the absolute as-of time. A simple dot plot inside the sampling box
is optional; **do not draw coastlines or runways** (nothing sourced). The tables are
the deliverable. Section intro: plain, British spelling, says planes are drawn from
their own transponder broadcasts, that receiver coverage is uneven, that cargo is not
shown, that operator is inferred from the callsign, and that a zero means no signal,
not an empty sky.

### A6. Tests: `scripts/tests/air.ts`
`callsignDesignator` (commercial pattern, registration, empty, padded, hostile text);
operator lookup; state-vector parser (null `states`, null position, null
`time_position`, wrong types, out-of-range values); box area check (every air node's
box is 25 square degrees or less); sequential querying and 429 handling (mock); the
privacy default (unmatched aircraft's callsign and icao24 appear **nowhere** in the
serialised output); canary credentials never in output; render test (no cargo claim,
no company name outside matched rows, empty state text).

## 6. Order of work

1. Prerequisites (section 0). Read Parts 1 and 2 as merged and the disruptions loader.
2. **3A:** C1 types and `isValidImo`, with tests first; C2 loader; C3 matching; C7
   tests for those; C4 import script; C5 UI additions; docs. `npm run check`,
   `npm run test:regressions`, `npm run build` (strict). Run `dev:demo` with
   `monitorEnabled` temporarily true **locally only** and a fixture carrier; look at
   390, 820 and 1180 px, keyboard-only, JavaScript off; axe-core as a one-off with
   `npx` (no `package.json` change). If you cannot run a browser, say so and do not
   claim visual checks you did not do. Revert the flag; confirm `launch.ts` is
   untouched. **Open PR 3A** (branch `claude/vessels-part-3a`).
3. **3B** only after 3A is open: A1, A3 (pure parts and tests), A2, A4, A5, A6, docs.
   Branch `claude/vessels-part-3b`, a second draft PR.

## 7. Decisions that are not yours (surface them in each PR)

- Whether a ship-to-company display is shown publicly at all, and whether carrier
  names appear next to individual named ships (needs both founders; `DECISIONS.md`).
- Whether Novus ever joins carriers to register entries (C6). Recommendation: no, not
  in code.
- The stale threshold (proposed 90 days) and the "start with three to five carriers"
  rule.
- Which carriers to load, and a person actually reading each page's terms (Gavin or
  Alex; not Claude Code).
- OpenSky: written confirmation that Novus may show their data on a product that may
  charge. Whoever emails them records the reply in `DECISIONS.md`. Until then 3B stays
  hidden.
- Which air-cargo operators and which airports go in the tables (the founders approve).
- Whether planes are worth keeping at all once a reply arrives.

## 8. Calls made in this handoff (check them)

1. Matching is by IMO only; names, prefixes and proximity are never evidence.
2. No real carrier or operator records are shipped by Claude Code; a person loads them
   from the carriers' own pages through a validating script.
3. Carrier appears as words only: no logos, no colours, no register join by company.
4. "Reports an IMO number that appears in X's list" wording, because the IMO is typed
   by the crew.
5. Stale threshold proposed at 90 days.
6. Eight airports, boxes of 25 square degrees or less, one credit each; a free
   registered OpenSky account is required.
7. Operator inference only from a three-letter callsign prefix, sourced from the FAA's
   public designator order.
8. Unmatched aircraft are counted, never identified.
9. 3A and 3B ship as two PRs; 3B stays hidden regardless.

## 9. Acceptance criteria (all must hold)

3A:
- [ ] `npm run check`, `npm run test:regressions`, `npm run build` pass.
- [ ] `monitorEnabled` is still `false`; `launch.ts` is untouched in the diff.
- [ ] No new dependency (`package.json` changes only by the added script entry;
      `package-lock.json` unchanged).
- [ ] `content/carriers/` contains **no records Claude Code wrote**; only the import
      path and fixtures exist. No IMO number in the repo came from memory.
- [ ] Matching is IMO-only and proven so by tests; invalid IMOs match nothing.
- [ ] With a fixture carrier and the flag on locally: the Carrier filter appears only
      when something matched, the details card shows the permitted wording and nothing
      else, the transparency table lists the lists held, and the empty state prints
      when none are loaded. JavaScript off still shows summaries.
- [ ] No carrier colour, logo or status colour; no register join by company; no cargo
      claim anywhere. The render test proves the last two.
- [ ] `/vessels.json` carries `carrierIds` and `/live.json` is unchanged.
- [ ] The measured payload sizes and what was and was not looked at are in the PR.

3B (if built):
- [ ] OpenSky credentials absent: the section says the source is not switched on; no
      network call is made. Present: one token request and one query per box.
- [ ] All air boxes are 25 square degrees or less; the credit arithmetic is in the PR.
- [ ] Unmatched aircraft's identifiers appear nowhere in output; no cargo claim.
- [ ] Every designator in the operator table cites the FAA edition and retrieval date.
- [ ] The PR's first lines say OpenSky's terms are unconfirmed and 3B must stay hidden.

## 10. What cannot be verified in this session, and who does it

- **Carrier fleet lists:** a person reads each carrier's own page and its terms, and
  loads the list through `carriers:import`. Claude Code's sandbox cannot reach most
  such sites, and must not fill the gap from memory.
- **Live AIS fields, especially the IMO field:** still unconfirmed until Alex's capture
  from Part 1 exists. If the broadcast IMO field is named or shaped differently from
  what Part 1 assumed, matching changes with it.
- **Registry fill rate:** unknown until `VESSEL_STORE=supabase` has run for days.
- **OpenSky:** Alex creates a free account and an API client on its Account page (no
  payment), adds `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` as repo secrets and
  Vercel environment variables (Production, then redeploy). Never pasted into chat,
  email or a commit. Alex or Gavin emails OpenSky about commercial use. Put these as
  numbered steps in `DEPLOY.md`.
- Token endpoint, parameter names and the category-code table: confirmed by reading
  OpenSky's live docs, or flagged unverified.

## 11. Hostile and malformed data

AIS and ADS-B are received from anyone. IMO numbers can be zero, repeated, reused or
copied from another ship; callsigns can be anything. Validate, drop and count; never
build SQL by string concatenation; never render broadcast text as HTML or put it in a
URL. The only links rendered are the `sources` URLs from validated records, with
`rel="noopener noreferrer"`.

## 12. Reporting back and the pull requests

- Branches `claude/vessels-part-3a` and, separately, `claude/vessels-part-3b`, each
  branched from `main`. **Draft PRs.** Do not merge, do not push to `main`, do not
  change repository, Vercel, Supabase, OpenSky or AISStream settings. If you cannot
  push, produce a patch.
- Gavin prefers results-first, plain language. Open each PR description and your final
  message with three plain lines: what now exists, what is still switched off, and what
  Alex or Gavin must decide or do next. Technical detail below.
- List the calls in section 8, anything unverified, any conflict between this file and
  the repo, and what the real expected match rate is (near zero until the registry
  fills).
- Do not tell Gavin it "works" on live data unless live data was seen. Until Alex's
  capture and the registry exist, it has only run on fixtures. Say exactly that.
