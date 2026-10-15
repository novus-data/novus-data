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
5. How often the briefing goes out.
6. The launch date.

## Deployment updates

- The production sequence is **#9, then #12, then #11**. The integration branch is `claude/practical-einstein-tzfg55`; #12 must land before the production switch so the prelaunch sign-in notice remains present.
- Monitor and Articles remain gated off for launch by `src/config/launch.ts`, as two separate switches (`monitorEnabled`, `articlesEnabled`) so either can go live without the other; that includes `/live.json`, direct article URLs, and article entries in `/feed.json`. Articles went live on 2026-10-14 (see "Articles go live"); enabling the monitor is `arowsom-oss`'s call (see "Launch calls passed to `arowsom-oss`", 2026-10-13); update this record when it happens.
- The subscribe URL moved from `https://novusdata.beehiiv.com/subscribe` to `https://newsletter.novusdata.news/?modal=signup`; update any remaining documentation that names the old URL.
