/**
 * Search and link-preview helpers. Pure functions, safe anywhere.
 *
 * Nothing here invents text. Each helper only shortens or reshapes text a
 * person already wrote, so a search result never says more than the page.
 */

/**
 * Google shows roughly the first 155 to 160 characters of a description, and
 * LinkedIn and X show fewer. A longer description is cut by them, mid-word,
 * wherever their limit falls.
 */
export const META_DESCRIPTION_MAX = 160;

/**
 * A sentence ends at `.`, `!` or `?` followed by a space and a capital letter
 * (or an opening quote or bracket and then one), or at the end of the text.
 * Requiring the capital keeps "No. 72", "3.75%" and "U.S. exports" whole.
 */
const SENTENCE_END = /[.!?](?=\s+["“‘(]?[A-Z]|\s*$)/g;

/**
 * Words whose full stop is not the end of a sentence even before a capital:
 * "11:59 p.m. Eastern", "St. Louis", "No. 4". Initialisms ("U.S.", "a.m.")
 * are caught by shape rather than listed.
 */
const ABBREVIATIONS = new Set([
  'no', 'nos', 'st', 'mr', 'mrs', 'ms', 'dr', 'inc', 'ltd', 'co', 'corp', 'vs', 'etc', 'approx',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

function endsWithAbbreviation(text: string, dotIndex: number): boolean {
  const start = text.lastIndexOf(' ', dotIndex) + 1;
  const token = text.slice(start, dotIndex + 1).replace(/^["“‘(]+/, '').toLowerCase();
  if (/^(?:[a-z]\.){2,}$/.test(token)) return true;
  return ABBREVIATIONS.has(token.slice(0, -1));
}

/**
 * A description short enough to show whole in a search result or a link
 * preview.
 *
 * Text that already fits is returned unchanged. Otherwise whole sentences are
 * kept while they fit; if the first sentence alone is too long, the text is
 * cut at the last word boundary and closed with an ellipsis, so it never ends
 * mid-word. Only the meta tag is shortened: the page and its structured data
 * keep the full text.
 */
export function metaDescription(text: string, max = META_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  let end = 0;
  for (const match of clean.matchAll(SENTENCE_END)) {
    const dot = match.index ?? 0;
    if (dot + 1 > max) break;
    if (match[0] === '.' && endsWithAbbreviation(clean, dot)) continue;
    end = dot + 1;
  }
  // A whole first sentence (or more) that fits and says something.
  if (end >= 60) return clean.slice(0, end);

  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  let head = space > 40 ? cut.slice(0, space) : cut;
  // A figure cut away from its unit or its date reads as a different figure:
  // "more than 5…" was "more than 5 million barrels". Drop it with the rest.
  const lastSpace = head.lastIndexOf(' ');
  if (lastSpace > 40 && /\d/.test(head.slice(lastSpace + 1))) head = head.slice(0, lastSpace);
  // Likewise a date cut away from its year: "from 14 October…" was
  // "from 14 October 2025", and a reader would assume the current year.
  if (/^\s*\d{4}\b/.test(clean.slice(head.length))) {
    const undated = head.replace(/\s+\d{1,2} [A-Z][a-z]+$/, '');
    if (undated.length > 40) head = undated;
  }
  return `${head.replace(/[\s,;:–—-]+$/, '')}…`;
}
