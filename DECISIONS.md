# Decisions

What has been decided about getting Novus Data live, and what is still open.
When a decision changes, change it here in the same pull request that acts on
it, so this file never describes a plan nobody is following.

People are named by GitHub account: `arowsom-oss` builds the website,
`Novous-Data` does the research.

## How decisions get made

Proposed by `arowsom-oss` on 2026-09-23. **Agreed by `Novous-Data` on
2026-09-24**, who widened the first rule: in his words, Alex "can do whatever
he wants" with the code, and the code is his too.

- **The website's pages and code** are `arowsom-oss`'s call, without needing
  to ask.
- **What the register claims about companies** is `Novous-Data`'s call. It is
  the research.
- **A big change needs both.** A big change is a new section, a new kind of
  data, or anything involving money. If both don't agree, it doesn't ship.

Why not "whoever builds it decides": Claude writes most of the code in this
repository, so that rule would really mean "whoever asks Claude first".
Ownership follows who is responsible for a thing being right, not who typed the
request.

## Launch calls passed to `arowsom-oss`

Agreed by `Novous-Data` on 2026-10-13, by text message. Asked to confirm
that `arowsom-oss` can make the launch calls, he replied: "Just tell it to
handle all of that."

- **Launch calls are now `arowsom-oss`'s alone**: when Articles or the
  monitor switches on, publishing order, and adding a section. The "both"
  rule above no longer applies to them.
- **Money still needs both.** The message was about launch, not about
  whether or how the site makes money.
- **The register's claims are still research under a person's name.** The
  same message asked Claude to "handle" the severity choices and the rewrites
  after the 14 October CPI release. Claude drafts those; a named person picks
  them and is recorded as the author. That follows the reason given above:
  ownership follows who is responsible for a thing being right. If that
  person is Alex, he goes on the masthead (`publication.authors`) before the
  first entry he records, or the register would credit Gavin with his
  choices.

## Subscribing by email while Beehiiv's sign-up is in question

Proposed by `arowsom-oss` and agreed by `Novous-Data` on 2026-10-15, by
email. Temporary.

- On 2026-10-15, test sign-ups through Beehiiv's hosted form did not appear
  in Audience > Subscribers. Before relying on this change, Audience is to be
  checked with all statuses shown: with double opt-in on, a sign-up stays
  pending until its confirmation email is clicked.
- While `subscribeVia` in `src/config/launch.ts` is `'mailto'`, the subscribe
  button opens an email to the contact address and the editor adds the
  sender to Beehiiv by hand. The site stores nothing.
- The on-site form and subscriber table in the spec of the same day were not
  adopted: anyone could submit another person's address, and Beehiiv imports
  skip double opt-in, so an import would claim a permission that was never
  given. An email sent from the address being subscribed is the record that
  its owner asked.
- Revert: set `subscribeVia` to `'beehiiv-link'` once a fresh test address
  completes Beehiiv's own sign-up and appears in Audience.
- Not merged until Gavin has checked Audience and approved the subscribe and
  /privacy copy, including the retention period he is to decide.

## The newsletter moved to a different Beehiiv account

Done by `arowsom-oss` on or before 2026-10-21, because the first account's
sign-up was unreliable. Recorded here on 2026-10-26.

- The sign-up button went back to Beehiiv's hosted form (#37, `subscribeVia`
  is `'beehiiv-link'`). The email fallback beside it stays.
- The site's footer and subscribe links, and `BEEHIIV_RSS_URL` for
  `npm run sync-issues`, now point at the new account's publication and feed
  (`Al3vKLY95D`). The Vercel settings were changed by hand; this repository
  names only the feed.
- The first sync from the new feed brought in the 22 October issue. Beehiiv
  listed it twice, an early copy that still carried two `[GAVIN: confirm or
  rewrite]` notes and the sent version without them; only the sent version is
  in the archive.

## Subscribe emails kept for 30 days

Decided by `arowsom-oss` on 2026-10-26. Under the 15 October email fallback, a
subscribe email is deleted 30 days after the address is added to Beehiiv, and
earlier on request. `/privacy` states it. The deletion is done by hand by
whoever reads the contact inbox, so it only holds if someone does it: a monthly
sweep. This applies only while subscribing by email is in use; with
`subscribeVia` set to `'beehiiv-link'` the site holds nothing.

## Two Claudes, one message board

Decided by `arowsom-oss` on 2026-10-26. The two Claude sessions talk through a
standing draft pull request that is never merged, under the rules in
`COORDINATION.md`. It is public, so nothing private goes on it, and a message
on it can ask or report but never approve. The first board (#41) was merged by
mistake on 2026-10-26; the board is now #43.

## Briefing header date left as sent

Decided by `arowsom-oss` on 2026-10-26. The 22 October briefing's header reads
"Wednesday, 21 October 2026" while Beehiiv's feed dates it 22 October. The
archive keeps what subscribers received, header included. Gavin is asked to make
the header date follow the send date from now on.

## Publishing schedule stated on the site

Stated by `Novous-Data` on 2026-10-27; set in the pull request that adds this entry, for `arowsom-oss` to approve:
Monday, Wednesday, Friday and Sunday, plus special editions. Monday, Wednesday
and Friday are news editions; Sunday is a longer look at the week ahead. The
site states only the days (`publication.cadence`), not the edition types. It
is a forward commitment: the 22 October issue went out on a Thursday. If the
schedule slips, change the setting rather than leave the claim standing. This
closes "How often the briefing goes out" under "Still open".

## Articles go live

Decided by `arowsom-oss` on 2026-10-14, under "Launch calls passed to
`arowsom-oss`" above. `articlesEnabled` is on, with all 19 of Gavin's
articles, each dated 14 October 2026.

- Gavin asked, by text on 2026-10-14, for the remaining fixes to be made
  here ("Tell your Claude to fix it"). The source swaps and the 0010 chart
  title went in first (#30).
- The three articles that refer to the 14 October CPI release (the Fed,
  jobs and Thirteen dates pieces) are accurate when the section opens,
  before the 8:30 a.m. Eastern release. Claude drafts the update after the
  release and `arowsom-oss` approves it before it merges, per the register
  rule above.

## All 19 articles confirmed

Confirmed by `Novous-Data` on 2026-10-15, by email: he is happy for the
Articles section to be live (it has been since 2026-10-14, see "Articles go
live") and for all 19 articles to be published.

- His updated files of 14 October were compared sentence by sentence with
  the live versions. They had nothing the live files lacked; the live files
  were newer (the September real-earnings, urea and Suez corrections).
- The oil article's EIA figures were updated before this confirmation, to
  14 October 2026 data (Brent spot $126.55, Gulf Coast jet fuel $4.56), and
  its chart redrawn from the same EIA series. The headline and argument
  still held, so no wording changed.

## The Mancalë Index

Proposed by `Novous-Data` on 2026-10-21, with the code, the method and the
first week of data in one change. It is a new section and a new kind of data.

- **Launch is `arowsom-oss`'s call** under "Launch calls passed to
  `arowsom-oss`" above. The change arrives with `mancaleEnabled` off in
  `src/config/launch.ts`: `/mancale` 404s and nothing links to it. Gavin has
  asked for it to go live; switching it to `true` is the launch, and this
  entry should then record when.
- **Launched 25 October 2026.** `arowsom-oss` switched `mancaleEnabled` to
  `true`, which also turns on `/mancale/scorecard`. At launch only Hormuz, the
  Red Sea and the Taiwan Strait have news data, so only those three can make
  scorecard calls; the page says so. Taking it down is one line: set the switch
  back to `false`.
- **Rule 1 was amended to allow it**, narrowly (CLAUDE.md §4): figures on
  `/mancale` only, each computed at build time from cited weekly data by the
  method printed on the page. No score is stored or typed by hand.
- **Before relying on the automatic ship download:** the IMF's terms say
  automated bulk download of IMF data, and any commercial reuse, need its
  permission. Gavin emailed copyright@imf.org on the evening of 25 October
  2026 (asking about a weekly automatic download, publishing the derived
  averages and scores with attribution, and a future paid tier); no reply as of
  27 October. Until then,
  `npm run mancale -- --ships-csv <file>` uses a CSV downloaded by hand from
  portwatch.imf.org. **Money still needs both**, and it would also need the
  IMF's permission for this data.
- **Known limits, stated on the page:** ship counts miss ships that turn their
  location signals off (the Hormuz article explains why), the news measure
  counts passing mentions, and the index is not seasonally adjusted. It
  describes; it does not forecast.
- The first data file has news volume for Hormuz, the Red Sea and the Taiwan
  Strait only: GDELT rate-limited the network it was built on. The first
  `npm run mancale` from a home connection should fill the other four.

## The Mancalë scorecard

Proposed by `Novous-Data` on 2026-10-25, drafted by Claude at Gavin's request,
as one change to `arowsom-oss`. It checks the index in public: whether the two
sharpest labels ("Ships ahead of news" and "News ahead of ships") were followed
by the lagging score catching up within four weeks, compared with an ordinary
week. Whether the labels predict anything is unproven, which is why it is
tested where readers can see it.

- **Launch is `arowsom-oss`'s call**, and it needs no second switch:
  `/mancale/scorecard` sits behind `mancaleEnabled`, so it 404s and is out of
  the sitemap until `/mancale` goes live. Both are then one launch.
- **No new kind of data.** Outcomes come from the Mancalë data alone. An outside
  series (the New York Fed's pressure index, FRED) was considered and left out,
  because it would be a second source with its own terms and a new kind of figure
  under Rule 1 and §13.
- **Rule 1 has a proposed extension** (CLAUDE.md §4, marked as proposed): counts
  and rates on `/mancale/scorecard` only, computed at build time. Merging the
  change is the author's acceptance. If it is not accepted, drop the page and
  keep the ledger.
- **One new file is written by the weekly refresh**: `content/indicators/
  mancale-ledger.json`, one line per week, labels only, never edited after it is
  written. It adds no manual step: `npm run mancale` writes it and the existing
  `git add content/indicators/` covers it. The first line is the week of
  2026-10-12, written 2026-10-25.
- **Fixed in advance, and not to be tuned.** The four-week window, the 1-point
  move, the ordinary-week rule, the 10-call minimum before a rate is shown and
  the 10-day limit for a call to count as recorded were set on 2026-10-25,
  before any result was calculated. A change is a new method version.
- **What the first run showed, stated plainly.** In the history, "Ships ahead of
  news" was followed by the news catching up in 15 of 29 calls (52%, range 34%
  to 69%) against 32% from an ordinary week. "News ahead of ships" was followed
  by the ships in 5 of 26 (19%, range 9% to 38%) against 17%, which is no
  different from chance. All of it is in-sample, because the index's thresholds
  were chosen on the same history. Only calls recorded as they happen count as a
  test, and none has settled yet.
- **Keeping the forward record honest takes one habit**: run `npm run mancale`
  within 10 days of each week ending (PortWatch publishes on Tuesdays). A late
  week is still safe to run, but its calls are listed as found afterwards.

## Photographs allowed, with their licence (Rule 3 amended)

Amended by `Novous-Data`, the author of the rules, on 2026-10-21. The site may
now show photographs, under the same source list the briefing already follows:
own photos, US federal government works, public domain or CC0, CC BY and
CC BY-SA, press libraries whose terms allow editorial use, and written
permission. NC and ND licences, wire and stock photos, search-engine and
social-media finds, screenshots and AI images stay out. CLAUDE.md Rule 3 has
the full text; `src/lib/photos/` enforces it, so a photo without a complete
licence record does not render. The site's code stays `arowsom-oss`'s call:
if he wants the policy tightened, it changes in that file and Rule 3
together.

## Visual refresh (proposed 27 October 2026)

Proposed by Gavin, drafted by his Claude, for Alex's review as one pull
request. The site's code is `arowsom-oss`'s call, so nothing here is settled
until he merges it; each item below can be reverted on its own. Gavin's brief
was to improve the site visually, build a rubric from professional news sites
(`DESIGN-RUBRIC.md`), add photographs where they are logical, and improve the
changes a second time against the rubric.

**What changed.** A solid navy primary button, used for subscribe only, labelled
"Get the free briefing" (it said "Subscribe on Beehiiv"). A one-row subscribe
strip above the lead, and a Subscribe button in the header from `lg` up and in
the mobile menu. Boxes that sat beside empty space now hold derived content: the
latest briefing, the other open entries and the mission in the rail beside the
lead; exposure rows and articles in three columns. A bordered status label and a
three-segment severity meter, both still beside their words. A dateline under
the nameplate ("Register reviewed <date> · Latest briefing <date>", read from the
data). A key on the home map and slightly firmer sea lanes. A grouped footer and
"Mancalë Index" in the header and footer. A link to `/about#method` from the
exposure boxes. Photographs reach a register entry through a `places` field on
its record (CLAUDE.md Rule 3), on the home lead and the entry page.

**Taken out, then put back (28 October).** The line "Map suggested by Mr. Kent."
was removed from both maps in this change, because a credit line under a map is
unusual on a publication. Alex asked for it to be restored before merging, since
the editors had asked for it, so it is back on both. It can move to `/about`
later if the editors prefer.

**Considered and not done.**

- *A big-figure callout on the home page.* Rule 1 forbids stat blocks. Any
  figure on the front page must come from the register at build time.
- *Unboxing the secondary content.* The 29 September decision, the author's,
  stands.
- *British to American spelling.* Slugs are permanent URLs and article bodies are
  synced from Beehiiv, so a global change would break links or be overwritten by
  the next sync.
- *A logo.* There is no file, and the brief forbids approximating one.
- *A photo on the Panama entry, for now.* A public-domain US Navy photograph of
  ships waiting to enter the Miraflores Locks (Commons file
  `US Navy 070828-N-1810F-078`, taken 28 August 2007 by Mass Communication
  Specialist 2nd Class Todd Frantom) was found and its licence read on its
  Commons page, but Wikimedia rate-limited this session's downloads, so the file
  was never fetched and no record was written for a photo nobody has looked at.
  Add the file and a record with `"places": ["panama"]` (CLAUDE.md Rule 3) and
  it appears on `/disruptions/panama-canal-drought-restrictions` with no code
  change. The caption must say it is a file photo from 2007.
- *A photo on the Section 301 entry.* It has no `places`, because a tariff has no
  location, and a photo that does not show what the text is about breaks Rule 3.
- *Header Subscribe at tablet width.* At 768px the seven links fill the row.

**Found and not fixed.** The latest briefing was published on 22 October and the
register was last reviewed on 13 October, so the new dateline shows a nine-day
gap. That is accurate, not a bug, but it is what a reader will see. Separately,
axe-core reports one target-size failure on `/mancale`: two map marker links
overlap at 24px. It was there before this change and is not touched by it.

## Launch

Decided by `arowsom-oss` on 2026-09-23, under the rule above. A big change
ships only when both agree, so one "not yet" is enough to hold it back.

- **The live monitor and prices are not in the launch.** They can be added
  afterwards, if both agree then.
- **Articles are not in the launch.** The section goes live once `Novous-Data`
  has finished an article, so it never opens empty.

## The editor

Decided by `Novous-Data` on 2026-09-24: **Gavin McGreevy** is the editor, the
first name on the masthead and the byline of record. It is set in
`src/config/publication.ts`, and a production build no longer stops for it.

## Where the repository lives

Done by `Novous-Data` on 2026-09-23: the repository moved into the free
organisation `novus-data`, which also fixes the "Novous" spelling. The address
is now `github.com/novus-data/novus-data`, and the old one redirects.

When this was written, `arowsom-oss` still had write access only, as an
outside collaborator. Becoming an owner: `Novous-Data` invites `arowsom-oss`
to the organisation with the role **Owner**, and he accepts (DEPLOY.md Part 7,
step 3).

## Still open

1. What goes live on launch day: the main branch as it is, or the main branch
   plus the fixes from pull request #9 (the new font, the print fix and the
   register bug fixes)? Code, so `arowsom-oss`'s call under the rule above.
2. Whether the site makes money, and how.
3. Whose account the site is hosted from.
4. The minimum content needed before launch.
5. ~~How often the briefing goes out.~~ Decided 2026-10-27, see "Publishing schedule stated on the site".
6. The launch date.

## Deployment updates

- The production sequence is **#9, then #12, then #11**. The integration branch is `claude/practical-einstein-tzfg55`; #12 must land before the production switch so the prelaunch sign-in notice remains present.
- Monitor and Articles remain gated off for launch by `src/config/launch.ts`, as two separate switches (`monitorEnabled`, `articlesEnabled`) so either can go live without the other; that includes `/live.json`, direct article URLs, and article entries in `/feed.json`. Articles went live on 2026-10-14 (see "Articles go live"); enabling the monitor is `arowsom-oss`'s call (see "Launch calls passed to `arowsom-oss`", 2026-10-13); update this record when it happens.
- The subscribe URL moved from `https://novusdata.beehiiv.com/subscribe` to `https://newsletter.novusdata.news/?modal=signup`; update any remaining documentation that names the old URL.
