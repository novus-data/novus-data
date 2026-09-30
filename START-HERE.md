# START HERE

You want to change something. This tells you which file, in one hop.

`CONTRIBUTING.md` is how the two of us work together without the standard
drifting. `CLAUDE.md` is the rulebook and explains *why* things are the way
they are.
`HANDOFF.md` is the open-questions list. `DEPLOY.md` is the deployment steps.
**This file is the index** — it assumes you know what you want and just need the
path.

---

## The four commands that matter

```bash
npm run doctor           where the project stands, and the one thing to do next
npm run new-disruption   write a register entry that is guaranteed to load
npm run review           the weekly register review, as a worklist
npm run check            typecheck + lint + doctor, before you commit
```

`npm run doctor` is the one to run when you sit down and cannot remember where
you left off. It reads the same ledger the production build refuses on, so it
cannot tell you something the build disagrees with.

---

## "I want to change…"

### …the words on the site

| What | File |
|---|---|
| The home page headline and the paragraph under it | `src/config/publication.ts` → `openingLine`, `openingBody` |
| The mission statement | `src/config/publication.ts` → `mission` |
| The sentence in Google results and shared links | `src/config/publication.ts` → `description` |
| Who the site says it is for | `src/config/publication.ts` → `primaryReader`, `secondaryReaders` |
| **The published standard of proof** at `/about#method` | `src/config/publication.ts` → `methodology` |
| The masthead — names and credentials | `src/config/publication.ts` → `authors` |
| The seven tracked topics | `src/config/coverage.ts` |
| The corrections policy | `src/config/publication.ts` → `corrections` |
| The briefing's or the app's name | `src/config/publication.ts` → `newsletter`, `alerts` |

**Nearly all site copy is in one file.** That is deliberate: the most visible
words on the site should be one edit away, not buried in a component.

Copy that is *not* in that file lives in the page that renders it — `/alerts`,
`/privacy` and `/about`'s surrounding prose are written inline because they are
essays, not facts.

### …the content

| What | Where |
|---|---|
| Add a disruption | `npm run new-disruption` → writes `content/disruptions/NN-id.md` |
| Edit a disruption | `content/disruptions/*.md` — the `id` is a permanent URL, never change it |
| Add an issue | Write and send in Beehiiv, then `npm run sync-issues` |
| Write an article or long-term review | `WRITING.md` — the research sheet, the skeleton and the checklist; publish in Beehiiv with the tag **Article** or **Long-term review**, then sync |
| Fix a typo in an issue | `content/issues/*.md` — it is yours now; the sync will not overwrite it |

### …how the site looks

| What | File |
|---|---|
| Colours, type scale, spacing tokens | `src/app/globals.css` → the `@theme` block |
| The newspaper furniture (`.kicker`, `.section-rule`) | `src/app/globals.css`, deliberately unlayered |
| Header, footer, navigation links | `src/config/nav.ts` |
| The exposure chart's cells and hover cards | `src/components/exposure-chart.tsx` |
| The severity colour ramp | `src/app/globals.css` → `--sev-low` / `--sev-moderate` / `--sev-high` |
| The wordmark and icons | `src/components/wordmark.tsx`, `src/app/icon.tsx` |

**There is no `tailwind.config.ts` and there should not be one.** Tailwind 4
keeps design tokens in `@theme` inside the CSS.

### …a page

Every route is a folder under `src/app/`. The folder name is the URL.

```
src/app/disruptions/page.tsx        →  /disruptions
src/app/disruptions/[id]/page.tsx   →  /disruptions/<id>
src/app/exposure/page.tsx           →  /exposure
```

### …the data layers

Three typed layers, each with the same shape. Pages import from the folder's
`index.ts` and never from `sources/` — the lint rule enforces it.

```
src/lib/content/       issues        an issue is a document
src/lib/disruptions/   the register  a disruption is a tracked state with a date
src/lib/accounts/      accounts      an account is per-user mutable state
```

Inside each: `types.ts` (pure, safe to import anywhere), `sources/` (where the
data actually comes from), `index.ts` (the public API).

---

## "I want to add a whole new thing"

### A new page

1. Create `src/app/<route>/page.tsx`.
2. Export `metadata` with `alternates: { canonical: absoluteUrl('/<route>') }`.
   Every page sets its own canonical — skipping it breaks the sitemap's honesty.
3. Add it to `src/config/nav.ts` if it belongs in the header or footer. The
   sitemap reads from there, so it is one edit and not three.
4. Use `<PageHeader>` and `<Container>` so it matches everything else.

### A new field on a disruption

1. Add it to the `Disruption` interface in `src/lib/disruptions/types.ts`.
2. Parse it in `src/lib/disruptions/sources/local-files.ts` — and decide what
   happens when it is missing. **Warn and drop, never guess.**
3. Mirror the validation in `scripts/new-disruption.ts` so the scaffolder cannot
   write a file the loader rejects.
4. Render it.
5. If it changes what an exposure must carry, update `/about#method` **in the
   same commit** — that page publishes the standard the code enforces.

### A new kind of data entirely

Make it a **fourth layer**, not a field on an existing one. `CLAUDE.md` §14.1
explains why: a document, a tracked assessment and a time series have different
shapes, refresh characteristics and failure modes, and merging them means the
worst of all three.

---

## The traps that have already bitten once

These are in `CLAUDE.md` in full. The short version, because each one cost real
time and each will come back if someone tidies the code:

- **`input-ledger.ts` must never reach the browser.** It asserts at module load.
  A client component importing it — even indirectly — drops every page into the
  error boundary. `publication.ts` is side-effect-free precisely so client
  components can read facts safely.
- **The `.prose-novus` rules in `globals.css` are unlayered on purpose.**
  `@tailwindcss/typography` registers `.prose` in the utilities layer, so
  anything in `@layer components` loses and issue bodies render near-invisible.
- **Feed discovery is a `<link>` element, not `metadata.alternates.types`.** Next
  merges metadata per top-level field, so any page setting its own `alternates`
  replaces the layout's object wholesale — and every page here sets `canonical`.
  As metadata it renders on zero routes, silently.
- **It is `src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention.
  Every Supabase guide still shows the old name.
- **`--accent` fails AA for text.** Use `--accent-text` for anything read or
  clicked. This gets "corrected" back during polish passes; do not.
- **`NEXT_PUBLIC_` inlines a value into the browser bundle.** Never add that
  prefix to silence an undefined-variable error. On a public repository the leak
  is permanent.

---

## Where things are

```
content/issues/        the issue archive of record
content/disruptions/   the register
scripts/               author tooling — doctor, review, scaffolder, sync
  lib/cli.ts             shared prompting, colour and env loading
src/config/            every fact the site states, and the navigation
src/lib/               the three typed data layers, plus env/format/og helpers
src/components/        presentational components
src/app/               routes, metadata routes, icons, error boundaries
```

---

## Before you commit

```bash
npm run check
```

typecheck, lint and doctor in one. If it is clean, the Vercel build will not
fail for a reason you could have caught locally.
