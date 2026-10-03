# Writing for Novus Data

The house format for **articles** and **long-term reviews**. Same headings
every time, so you never start from a blank page and a reader always knows
where to look. Briefings have their own shape; this file is for writing done
for the site.

---

## The short version

1. **Pick the question** from the topic menu (below) or from something that
   moved this week.
2. **Fill in the research sheet** (20–40 minutes). No prose yet.
3. **Paste the skeleton** into a new Beehiiv post and turn the sheet into
   sentences, one section at a time.
4. **Run the checklist.** Every item, every time.
5. **Publish** in Beehiiv with the tag **Article** (or **Long-term review**).
6. **Sync**: `npm run sync-issues`, review the file, commit, push.

A first article takes about three hours. By the third it should take two.

---

## 1. The research sheet — fill this in first

Copy it into a note (Notion, Notes, a Google Doc) and fill every line before
writing a sentence of the article. If a line stays empty, the article is not
ready.

```text
QUESTION       One sentence. What does the reader not know yet?
ANSWER         One sentence. What I will tell them. (This becomes the subtitle.)

WHAT HAPPENED  Date:            (absolute, e.g. 14 September 2026)
               Where:
               Primary source:  (canal authority notice, customs data, filing,
                                 regulator text — not a news summary of one)
               Link:

MECHANISM      Event  →  what it does to capacity, cost or time
                      →  which lane, product or input that lands on
                      →  who pays, and roughly when

WHO IT REACHES (one line each; these are register-ready)
               Name / sector:
               How it reaches them:
               Confidence:      reported | inferred | estimated
               Source + link:

WHAT WOULD CHANGE MY VIEW   Two or three signposts, and where to watch each.

SOURCES        Every link used, with publisher and date.
```

**Confidence**, the same three words the site uses on the exposure chart:

- **Reported:** stated by the company, a regulator or a named report.
- **Inferred:** follows from disclosed facts, such as filings or published
  routings.
- **Estimated:** a judgement from partial information. Treat it as the weakest
  claim.

---

## 2. The article skeleton

For something moving now. **600–1,000 words.** One idea per article.

Paste this into Beehiiv. Make each `##` line a **Heading 2** in the Beehiiv
editor, and delete the guidance in brackets as you write.

```text
TITLE
[A finding, not a topic. Says what happened and who it reaches.
 Under 12 words. Pattern: "[Constraint] at [place] reaches [who] through [how]".]

SUBTITLE
[The ANSWER line from the sheet. One sentence, under 30 words.
 Beehiiv's subtitle becomes the standfirst on the site.]

## What happened
[2–3 short paragraphs. Absolute dates. Link the primary source in the first
 paragraph. Facts only here, no interpretation yet.]

## Why it matters
[The MECHANISM chain as prose: event → capacity, cost or time → which lane or
 input → who pays and when. One paragraph per link is enough.]

## Who it reaches
[One short paragraph per name or sector. Each states HOW it reaches them,
 the confidence (reported / inferred / estimated) and links the source.
 Fewer, well-sourced names beat a long list.]

## What would change this view
[2–3 signposts: what would show this is worse, better or wrong,
 and where a reader can check.]

## Sources
[Numbered: 1. Title — Publisher, date. Link.]

Novus Data publishes analysis and commentary, not investment advice.
```

---

## 3. The long-term review skeleton

Steps back over a quarter or half-year. **1,200–2,000 words.** Tag it
**Long-term review**.

```text
TITLE
[Topic: period in review. e.g. "Chokepoints: July–September 2026 in review"]

SUBTITLE
[What changed over the period, in one sentence.]

## What I expected
[What earlier articles and register entries said, linked. If there were none,
 say what the consensus was at the start of the period, with a source.]

## What happened
[The period in 3–5 dated events, each sourced.]

## What held and what did not
[The honest scorecard. Name what was right and what was wrong. A review that
 is never wrong is not believed.]

## What it means for the next quarter
[Mechanisms still in play, and the signposts to watch.]

## Sources

Novus Data publishes analysis and commentary, not investment advice.
```

---

## 4. House style

1. **Absolute dates.** "14 September 2026", never "last week". The article
   is read for months.
2. **Every figure has a source and a date**, in the same sentence or linked
   from it. If you cannot source a number, cut it (Rule 1).
3. **Primary sources first.** A news article is how you find a story, not
   how you prove it. Link the notice, the filing or the data release.
4. **Mechanism, not "affected".** Say how the problem reaches a company or
   leave the company out.
5. **Say how sure you are**, using reported, inferred or estimated.
6. **First person singular** ("I think", "I expected"). You wrote it. No
   "our team" or "our analysts" (Rule 2).
7. **No advice.** No price targets, no buy or sell language, no "investors
   should". Describe the exposure, not the trade.
8. **Short sentences, plain words.** Cut: *unprecedented, massive,
   game-changing, crucial, skyrocket, plummet, it is worth noting that*.
9. **One idea per article.** A second idea is a second article.
10. **Headlines state a finding.** "Why the Panama Canal matters" is a topic;
    a finding says what changed and for whom.

---

## 5. Checklist before you press publish

- [ ] The title states a finding, and the subtitle answers the question.
- [ ] Every date is absolute.
- [ ] Every number has a source and a date.
- [ ] The first paragraph links a primary source.
- [ ] Every name under "Who it reaches" has a mechanism, a confidence and a
      source.
- [ ] Nothing reads as advice to buy or sell anything.
- [ ] No banned words (house style, rule 8).
- [ ] "What would change this view" has real, checkable signposts.
- [ ] Every link opens and goes where it says.
- [ ] The Beehiiv tag is **Article** or **Long-term review**, not left blank.
      A blank tag files the post as a briefing.
- [ ] The URL slug in Beehiiv is short and final. **Once published it is a
      permanent address; do not change it.**
- [ ] Read it aloud once. Anything you stumble on, rewrite.

---

## 6. The topic menu

The seven topics are the ones on `/coverage` (`src/config/coverage.ts`).
Each has questions that make good **explainers**: pieces that stay true for
months, need no breaking news, and teach the reader the vocabulary the rest
of the site uses.

**Start with explainers.** They are the easiest to source well, they do not go
stale, and every later article can link back to them. A good first three: one
on chokepoints, one on freight rates and one on trade policy.

| Topic | Explainer questions |
|---|---|
| Chokepoints and canal transits | How does a canal decide who gets through when capacity is cut? · What does a longer route do to the number of ships available everywhere else? · What is war-risk insurance, and who ends up paying it? |
| Container shipping and freight rates | What is the difference between spot and contract rates, and why does it matter who is on which? · What is a blank sailing, and what does a run of them signal? · Why can freight move within days of a disruption when most prices take a quarter? |
| Ports, terminals and inland connections | Why is dwell time a better signal than volume? · How does congestion at one gateway port show up in import data later? · Why is the inland leg (rail, chassis, trucking) usually where delay compounds? |
| Trade policy, tariffs and export controls | What decides whether a tariff is passed through, absorbed or avoided? · How does an export licence on one processed input reach sectors that never import it? · Why do effective dates and exclusions matter more than the headline? |
| Critical minerals and industrial inputs | Why does concentration usually sit at refining rather than mining? · How long does qualifying a new supplier take, and why? · What makes an input hard to substitute? |
| Energy and bunker costs | Why does bunker fuel set a floor under freight rates? · How do fuel surcharges pass through, and on what lag? · What do emissions rules add to the cost of moving goods? |
| The macro data trade moves through | What does the supplier-deliveries component of a manufacturing survey actually measure? · How do you tell a supply constraint from a demand shift in the releases? · Which release to read first when a chokepoint closes, and why. |

**Event articles** come from the register and the week's news: when something
moves, the question is always the same. What happened, how does it reach
whom, and what would change the view. The skeleton already asks it.

**Every article should feed the register.** Each line under "Who it reaches"
has the four things a register exposure needs. After publishing, run
`npm run new-disruption` and enter them. The article explains; the register
keeps the record.

---

## 7. Publishing it

1. In Beehiiv: **New post**. Title, subtitle, then the body from the
   skeleton.
2. Add the content tag **Article** or **Long-term review**. This tag decides
   where the post appears; without it the post is filed as a briefing.
3. Publish to the **web**. Emailing an article to subscribers is optional; the
   briefing is what they signed up for.
4. On your computer: `npm run sync-issues -- --dry-run`, then
   `npm run sync-issues`. The sync prints where each post will appear.
5. Review the new file in `content/issues/`, then commit and push.

**At launch `/articles` is switched off** (`articlesEnabled` in
`src/config/launch.ts`). Synced articles are saved but not shown. The section
opens once the first article is finished and Gavin and Alex agree
(`DECISIONS.md`). Keep writing while it is off: when it opens, it opens with
something in it.

---

## 8. Using Claude or ChatGPT

**Fine:**

- finding primary sources;
- checking your research sheet for gaps;
- checking every number against its source;
- tightening sentences you wrote;
- running the checklist.

**Not fine:** having it write the analysis.

The byline is yours, and a reader in finance can tell. An article that reads
as generated does more damage to the site's credibility than no article. The
research sheet is the guard: if you filled it in yourself, the argument is
yours.
