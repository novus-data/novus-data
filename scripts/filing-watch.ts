/**
 * `npm run filing-watch` — companies that name a register problem in their own
 * SEC filings, as a worklist for the person who keeps the register.
 *
 *   npm run filing-watch                         every entry in filing-watch-terms.ts, last 45 days
 *   npm run filing-watch -- --since 2026-10-01   a different start date
 *   npm run filing-watch -- --entry strait-of-hormuz-closure
 *   npm run filing-watch -- --excerpts           also open each filing and print the passage
 *   npm run filing-watch -- --json out.json      write the worklist as JSON too
 *
 * WHY THIS EXISTS
 *
 * The register's strongest confidence level is `reported`: the company itself
 * said it. Public companies say a great deal in their 10-Ks, 10-Qs and 8-Ks,
 * and EDGAR's full-text search can find every filing that names a chokepoint,
 * a tariff or a metal. That turns "who does this reach?" from a guess into a
 * list of companies that have written it down, each with a link to the page.
 *
 * WHAT IT DOES NOT DO
 *
 * It never writes to content/ (scripts/lib/cli.ts rule 2). A filing that
 * mentions the Strait of Hormuz in a list of generic risks is not an exposure,
 * and only a person reading the passage can tell the two apart. So this prints
 * leads; an assessment exists only when someone writes its mechanism,
 * severity, confidence and source into the entry, where the loader holds it to
 * the same four-field rule as every other claim (CLAUDE.md §6a).
 *
 * THE SOURCE AND ITS RULES
 *
 * EDGAR is the SEC's public filing system. Its contents are US Government
 * works, free to use, and its full-text search (efts.sec.gov) needs no key.
 * The SEC's fair-access policy asks automated clients to name themselves in
 * the User-Agent header (an organisation and a contact address) and to stay
 * well under ten requests a second. This script sends one request every
 * 250 ms and takes the contact address from NEXT_PUBLIC_CONTACT_EMAIL, or
 * SEC_USER_AGENT if you set one. https://www.sec.gov/os/accessing-edgar-data
 *
 * Coverage: companies that file with the SEC, which means US-listed companies
 * and foreign issuers with US listings (20-F, 6-K). A private company, or one
 * listed only abroad, will never appear here, so an empty result is not
 * evidence that nobody is exposed.
 */

import { writeFileSync } from 'node:fs';

import { FILING_WATCH_TERMS } from './filing-watch-terms';
import { blank, colour, detail, heading, info, loadEnvLocal, ok, plural, today, warn } from './lib/cli';

const SEARCH = 'https://efts.sec.gov/LATEST/search-index';
const FORMS = ['10-K', '10-Q', '8-K', '20-F', '6-K'];
const PAGE = 100;
/** Hard cap per term, so one very common phrase cannot run for minutes. */
const MAX_PER_TERM = 300;
const DEFAULT_LOOKBACK_DAYS = 45;
const SPACING_MS = 250;

export interface FilingLead {
  entryId: string;
  company: string;
  ticker: string | null;
  cik: string;
  form: string;
  fileDate: string;
  url: string;
  term: string;
  /** True when a company with this ticker or name is already in the entry. */
  alreadyInEntry: boolean;
  excerpt?: string;
  /** How specific the printed passage is (passageScore); only orders the list. */
  score?: number;
}

interface EftsHit {
  _id: string;
  _source: {
    ciks?: string[];
    display_names?: string[];
    form?: string;
    root_forms?: string[];
    file_date?: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * "RADIANT LOGISTICS, INC  (RLGT)  (CIK 0001171155)" → name and first ticker.
 * A display name with no ticker in brackets gets `null`, never a guess: the
 * register's rule is that a ticker is filled in only when checked.
 */
export function parseDisplayName(display: string): { company: string; ticker: string | null } {
  const company = display.replace(/\s*\(CIK \d+\)\s*$/, '').replace(/\s*\(([^)]*)\)\s*$/, '').trim();
  const brackets = [...display.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim());
  const tickerGroup = brackets.find((b) => !/^CIK /.test(b));
  const ticker = tickerGroup ? tickerGroup.split(/[,\s]+/)[0] || null : null;
  return { company: company.replace(/\s{2,}/g, ' '), ticker };
}

/** "0001171155-26-000003:rlgt-ex99_1.htm" + CIK → the document's address on sec.gov. */
export function documentUrl(id: string, cik: string): string {
  const [accession, file] = id.split(':');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${file}`;
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|corp|corporation|co|company|ltd|limited|plc|sa|ag|nv|holdings?|group|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function userAgent(): string {
  if (process.env.SEC_USER_AGENT) return process.env.SEC_USER_AGENT;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (!contact) {
    throw new Error(
      'The SEC asks automated clients to give a contact address. Set NEXT_PUBLIC_CONTACT_EMAIL in .env.local ' +
        '(the site already needs it), or SEC_USER_AGENT="Novus Data you@example.com".',
    );
  }
  return `Novus Data ${contact}`;
}

async function getJson(url: string, ua: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' } });
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      warn(`SEC search answered HTTP ${response.status}; waiting ${attempt * 5}s (attempt ${attempt}).`);
      await sleep(attempt * 5000);
      continue;
    }
    throw new Error(`SEC search answered HTTP ${response.status} for ${url}`);
  }
  throw new Error(`SEC search kept failing for ${url}`);
}

async function search(phrases: string[], since: string, until: string, ua: string): Promise<EftsHit[]> {
  const hits: EftsHit[] = [];
  for (let from = 0; from < MAX_PER_TERM; from += PAGE) {
    const url = new URL(SEARCH);
    url.searchParams.set('q', phrases.map((p) => `"${p}"`).join(' '));
    url.searchParams.set('forms', FORMS.join(','));
    url.searchParams.set('startdt', since);
    url.searchParams.set('enddt', until);
    url.searchParams.set('from', String(from));
    const body = (await getJson(url.toString(), ua)) as { hits?: { hits?: EftsHit[]; total?: { value?: number } } };
    const page = body.hits?.hits ?? [];
    hits.push(...page);
    await sleep(SPACING_MS);
    const total = body.hits?.total?.value ?? 0;
    if (page.length < PAGE || hits.length >= total) break;
  }
  return hits;
}

/** The sentence or two around the first mention of `term`, from the filing's text. */
async function excerpt(url: string, term: string, ua: string): Promise<string | undefined> {
  const response = await fetch(url, { headers: { 'User-Agent': ua } });
  await sleep(SPACING_MS);
  if (!response.ok) return undefined;
  const text = (await response.text())
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');
  // A filing can name the term many times, most often in a list of generic
  // risks. Print the passage that says the most about the company itself:
  // first-person words beside words of effect. This only chooses which
  // passage to show; it decides nothing about whether there is an exposure.
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  let best: { passage: string; score: number } | undefined;
  for (let at = lower.indexOf(needle), seen = 0; at >= 0 && seen < 12; at = lower.indexOf(needle, at + 1), seen += 1) {
    const start = Math.max(0, at - 450);
    const end = Math.min(text.length, at + needle.length + 450);
    const passage = text.slice(start, end).trim();
    const score = passageScore(passage);
    if (!best || score > best.score) best = { passage, score };
  }
  return best?.passage;
}

const EFFECT_WORDS =
  /\b(rerout\w*|delay\w*|surcharge\w*|increased (?:cost|freight|shipping|fuel)\w*|higher (?:cost|freight|fuel|energy)\w*|disrupt\w*|shortage\w*|suspend\w*|halt\w*|impact\w*|headwind\w*|curtail\w*|allocation|force majeure|longer transit|price increase\w*)\b/gi;
const FIRST_PERSON = /\b(we|our|us)\b/gi;
const BOILERPLATE = /\b(could|may|might|such as|including, but not limited to|among other things)\b/gi;

/** Higher for a passage that says what happened to the company, lower for a generic risk list. */
export function passageScore(passage: string): number {
  const count = (re: RegExp) => (passage.match(re) ?? []).length;
  return count(EFFECT_WORDS) * 2 + Math.min(count(FIRST_PERSON), 6) - count(BOILERPLATE);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const until = today();
  const since =
    flag('--since') ??
    new Date(Date.parse(`${until}T00:00:00Z`) - DEFAULT_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const onlyEntry = flag('--entry');
  const jsonOut = flag('--json');
  const withExcerpts = args.includes('--excerpts');
  const ua = userAgent();

  const { listDisruptions } = await import('@/lib/disruptions');
  const register = await listDisruptions();
  const byId = new Map(register.map((entry) => [entry.id, entry]));

  heading(`Filing watch: SEC filings from ${since} to ${until}`);
  info(`Forms searched: ${FORMS.join(', ')}. A lead is a filing to read, not an assessment.`);

  const leads: FilingLead[] = [];
  for (const [entryId, watch] of Object.entries(FILING_WATCH_TERMS)) {
    if (onlyEntry && entryId !== onlyEntry) continue;
    const entry = byId.get(entryId);
    if (!entry) {
      warn(`${entryId}: in filing-watch-terms.ts but not in the register. Remove the line or fix the id.`);
      continue;
    }
    if (entry.status === 'resolved') {
      detail(`${entryId}: resolved, skipped.`);
      continue;
    }

    const known = new Set<string>();
    for (const exposure of entry.exposures) {
      if (exposure.entity.ticker) known.add(`t:${exposure.entity.ticker.toUpperCase()}`);
      known.add(`n:${normaliseName(exposure.entity.name)}`);
    }

    const byCompany = new Map<string, FilingLead>();
    for (const term of watch.terms) {
      const phrases = watch.alsoNeeds ? [term, watch.alsoNeeds] : [term];
      const hits = await search(phrases, since, until, ua);
      for (const hit of hits) {
        const cik = hit._source.ciks?.[0];
        const display = hit._source.display_names?.[0];
        if (!cik || !display) continue;
        const { company, ticker } = parseDisplayName(display);
        const lead: FilingLead = {
          entryId,
          company,
          ticker,
          cik,
          form: hit._source.form ?? hit._source.root_forms?.[0] ?? 'unknown',
          fileDate: hit._source.file_date ?? '',
          url: documentUrl(hit._id, cik),
          term,
          alreadyInEntry:
            (ticker !== null && known.has(`t:${ticker.toUpperCase()}`)) || known.has(`n:${normaliseName(company)}`),
        };
        // One lead per company per entry: the most recent filing.
        const previous = byCompany.get(cik);
        if (!previous || previous.fileDate < lead.fileDate) byCompany.set(cik, lead);
      }
    }

    const entryLeads = [...byCompany.values()].sort((a, b) => b.fileDate.localeCompare(a.fileDate));
    if (withExcerpts) {
      for (const lead of entryLeads.filter((l) => !l.alreadyInEntry)) {
        lead.excerpt = await excerpt(lead.url, lead.term, ua);
        lead.score = lead.excerpt ? passageScore(lead.excerpt) : undefined;
      }
      entryLeads.sort((a, b) => (b.score ?? -99) - (a.score ?? -99) || b.fileDate.localeCompare(a.fileDate));
    }
    leads.push(...entryLeads);

    blank();
    console.log(colour.bold(`${entry.title}`) + colour.dim(`  (${entryId})`));
    const fresh = entryLeads.filter((l) => !l.alreadyInEntry);
    info(
      `${plural(entryLeads.length, 'company', 'companies')} named it; ${fresh.length} not yet in the entry.` +
        (watch.alsoNeeds ? ` Filings also had to say "${watch.alsoNeeds}".` : ''),
    );
    for (const lead of fresh) {
      console.log(
        `  ${colour.cyan(lead.ticker ?? '—').padEnd(14)} ${lead.company} · ${lead.form} · ${lead.fileDate}\n      ${colour.dim(lead.url)}`,
      );
      if (lead.excerpt) console.log(`      ${colour.dim('“' + lead.excerpt.slice(0, 600) + '”')}`);
    }
  }

  if (jsonOut) {
    writeFileSync(jsonOut, `${JSON.stringify({ since, until, forms: FORMS, leads }, null, 2)}\n`);
    blank();
    ok(`Wrote ${plural(leads.length, 'lead')} to ${jsonOut}.`);
  }

  blank();
  info('Next: read the passage behind each lead. If the company describes a real way the problem reaches it,');
  info('add an exposure to the entry with confidence "reported", the filing as its source, and the as-of date');
  info('the company gives. If it only lists the problem among generic risks, leave it out.');
  blank();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
