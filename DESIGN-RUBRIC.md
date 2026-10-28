# DESIGN-RUBRIC.md

A rubric for judging this site's pages against professional-yet-interesting
news and financial publications. Written 27 October 2026 for the visual
refresh (see DECISIONS.md, "Visual refresh"). Use it before and after any
change to the front page, a section index, or the shared components, and put
the two totals in the pull request.

It exists because "make it look more professional" is not something two people
can agree on, and because the site's own rules (CLAUDE.md §4) rule out some of
the usual ways of looking professional: no logos of other organisations, no
stat blocks, no testimonials, no stock photos. A rubric tells a reviewer what
to look at instead.

## How to score

Score each dimension 0 to 4 from evidence you can point to: a screenshot at
1180 px and 390 px, a measurement, a line of the page. Anchors are given for 0,
2 and 4; 1 and 3 sit between them. Total out of 68.

Then run the **gates**. A gate is pass or fail. A failed gate means the change
does not ship, whatever the total. A rubric that let a high score buy back a
fabricated number would be backwards for a site whose whole claim is that it
does not publish them.

Scores are a judgement, not a measurement. If the same person built the change
and scores it, they will lean high. Say who scored, and prefer the dimensions
that have a check you can run.

## Gates (pass or fail)

| # | Gate | Fails if |
|---|---|---|
| G1 | No invented figures or social proof | Any count, rate, logo, quote or "trusted by" that is not computed from cited data or a real record (Rule 1) |
| G2 | No implied organisation | "Our team", "our analysts", an office, a headcount or a founding year that has not happened (Rule 2) |
| G3 | Photos are licensed and credited | A photo with no licence record, no credit line, a hotlinked file, or one that does not show what the text is about (Rule 3) |
| G4 | Nothing states more than its source supports | A claim without a mechanism, confidence, date and source; a stale entry presented as current (§6a) |
| G5 | The managing-director test | A line of copy or a design choice that would embarrass the author if a finance professional opened the page: hype words, overstatement, a figure with no source |

## Dimensions

### A. Orientation: what a reader gets in ten seconds

| # | Dimension | 0 | 2 | 4 | Check |
|---|---|---|---|---|---|
| A1 | One lead, clear hierarchy | Everything the same weight | A lead exists but competes with its neighbours | One story visibly dominates; at least three distinct type levels; the eye path is obvious | Squint test. Lead headline at least 1.5 times the next level. |
| A2 | Section structure | One undifferentiated column | Sections exist but are labelled inconsistently | Every band is labelled; every box follows one grammar; order is the same on every page | Count the box types. Fewer than four is good. |
| A3 | Density without dead space | Large empty areas inside boxes or beside content | Occasional gaps from boxes of mismatched height | Every box is filled with real content; no gap larger than a line of text inside a box | Screenshot. Look for any box whose interior is more than a quarter empty. |

### B. Trust: what makes a sceptical reader believe it

| # | Dimension | 0 | 2 | 4 | Check |
|---|---|---|---|---|---|
| B1 | Freshness is visible | No dates | Some items dated, in mixed formats | Every dated item carries an absolute date in one format; the front page says when it was last reviewed; nothing old looks current | Read every date on the page. |
| B2 | Sourcing is visible | Claims with no source | Sources exist but are a click or two away | Every claim links to its source from where it is made | Follow three claims to their sources. |
| B3 | People and contact | Anonymous, no contact | Names somewhere | Named authors on the page, a working contact route, nothing implying a larger organisation than exists | Find the author and the contact in under ten seconds. |
| B4 | Method and corrections | Not stated | Stated, but not findable | Method and corrections are published, linked from where the claims are made | Click through to the method. |

### C. Visual interest: why it is not just a text file

| # | Dimension | 0 | 2 | 4 | Check |
|---|---|---|---|---|---|
| C1 | Imagery shows the subject | None, or decoration | One credited photo | Photos only where they show what the text is about, each captioned, dated if not current, and credited | Gate G3 first. Then ask of each photo: what would be lost without it? |
| C2 | Data graphics | Decorative or unlabelled | Legible but no key | Every graphic has a key; meaning is never carried by colour alone; the chart is the content, not an ornament | Check each graphic in greyscale. |
| C3 | Distinctive furniture | Looks like a template | Some custom elements | A grammar of its own (kickers, rules, mono figures, ruled boxes) used consistently, so the page reads as a publication | Ask: would a reader take this for a generated page? |

### D. Craft

| # | Dimension | 0 | 2 | 4 | Check |
|---|---|---|---|---|---|
| D1 | Type system | Default fonts, one size | A scale, but inconsistent use | A defined scale, a measure under about 70 characters, words and figures set differently on purpose | Inspect the computed styles of five elements. |
| D2 | Colour restraint and meaning | Many colours, no logic | A palette, with some arbitrary use | A few colours, each with one job; status colour never appears without its word | Count the colours on a page. |
| D3 | Consistency | Each page invents its own | Mostly consistent | One format for dates, labels, buttons and counts across the site | Compare the same thing on three pages. |

### E. Use

| # | Dimension | 0 | 2 | 4 | Check |
|---|---|---|---|---|---|
| E1 | One clear primary action | None, or several equal | One, but it blends in | One filled control for the one thing the site wants, visible on the first screen at 390 px, with no hype | Count the filled controls on the first screen. |
| E2 | Navigation clarity | Labels a stranger cannot interpret | Clear labels, no grouping | Labels say what the thing is; the footer is grouped; the header fits at every width | Ask a stranger what each label opens. |
| E3 | Mobile | Overflows or hides content | Works, with awkward spots | No horizontal overflow at 390, 820 and 1180 px; targets at least 44 px; the first screen has the lead and the action | `shots.mjs` reports overflow. |
| E4 | Accessibility and speed | Fails basic checks | Passes automated checks only | Zero axe-core violations; AA contrast; keyboard reachable; static pages; photos under about 250 KB | Run axe-core. Check image sizes. |

## What the reference set is good for

These are reference points, not templates. Where a statement is sourced it says
so; the rest is the author's judgement and should be read as opinion.

- **Financial Times.** Calm authority. Sourced: its 2014 redesign separated
  daily news from analysis and comment and moved to a six-column grid to make
  reading comfortable, keeping its existing tone of seriousness, calm and authority
  (Design Week, September 2014). Informs A1, A2, D1.
- **The Economist.** Restraint with one strong colour and a consistent
  furniture of its own. Informs C3, D2. (Opinion.)
- **Bloomberg.** Density and data as the content. Informs A3, C2. (Opinion.)
- **Reuters.** Plainness and speed, with datelines. Informs B1. (Opinion.)
- **The New York Times.** Sourced: from May 2023 its "enhanced bylines" say how
  a story was reported, because its Trust team's research found readers trust
  journalism more when they understand how it was produced (Nieman Lab, May
  2023). Informs B3, B4.
- **Stanford Web Credibility Guidelines.** Sourced: ten research-backed
  guidelines, among them make facts easy to check, show the real people behind
  the site, keep content current or show it was recently reviewed, look
  professional or fit your purpose, and eliminate errors. Informs B1 to B4, E4.
  One of them (list a physical address and offices) conflicts with Rule 2 for a
  two-person publication; this rubric follows the rule.

Sources: Design Week, "How the FT developed its new look"
(designweek.co.uk, September 2014); Nieman Lab, "The New York Times launches
enhanced bylines" (niemanlab.org, May 2023); Stanford Persuasive Technology
Lab, Stanford Web Credibility Guidelines (credibility.stanford.edu).

## Changing the rubric

Change the anchors when a dimension stops separating good from bad. Never
change them after scoring a change, to make the score come out better; that is
the same fault as tuning the Mancalë scorecard's constants to a result.
