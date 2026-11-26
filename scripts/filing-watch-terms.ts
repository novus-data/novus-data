/**
 * What `npm run filing-watch` searches SEC filings for, per register entry.
 *
 * One line per open entry worth watching. Each term is sent to EDGAR's
 * full-text search as an exact phrase, so pick the words a company would
 * actually write in a filing ("Strait of Hormuz", "de minimis"), not the
 * register's own title. Two or three terms is plenty; every extra term is
 * another request under the SEC's fair-access limit.
 *
 * An entry that is not listed here is simply not swept. A listed id that is
 * not in the register, or whose entry has resolved, is reported and skipped.
 *
 * This file decides what gets *looked at*, never what gets published. A hit is
 * a lead for a person to read; it becomes an assessment only when someone
 * writes its mechanism, severity, confidence and source into the entry by hand.
 */

export interface FilingWatchTerms {
  /** Exact phrases. A hit is any filing containing at least one of them. */
  terms: string[];
  /**
   * Optional phrase a filing must ALSO contain, to cut boilerplate. Used for
   * words that have other meanings ("Red Sea" appears in hotel and tourism
   * filings; with "shipping" it is about the shipping lane).
   */
  alsoNeeds?: string;
}

export const FILING_WATCH_TERMS: Record<string, FilingWatchTerms> = {
  'strait-of-hormuz-closure': { terms: ['Strait of Hormuz'] },
  'qatar-uae-lng-stranded': { terms: ['Qatari LNG', 'Ras Laffan'] },
  'red-sea-houthi-embargo': { terms: ['Red Sea'], alsoNeeds: 'Houthi' },
  'bab-el-mandeb-tanker-traffic': { terms: ['Bab el-Mandeb', 'Bab-el-Mandeb'] },
  'suez-canal-surcharges': { terms: ['Suez Canal'] },
  'china-rare-earth-export-controls': { terms: ['rare earth', 'rare earths'], alsoNeeds: 'export control' },
  'china-gallium-germanium-antimony-ban': { terms: ['gallium', 'germanium'] },
  // Not "DRAM" alone: restaurant and bar filings are full of "dram shop" laws.
  'dram-nand-allocation': { terms: ['memory shortage', 'DRAM shortage', 'DRAM prices', 'NAND prices'] },
  // "de minimis" alone is everywhere in accounting; with "exemption" and
  // "tariff" it is almost always the US low-value import rule.
  'us-de-minimis-suspension': { terms: ['de minimis exemption'], alsoNeeds: 'tariff' },
  'section-232-metals-tariff': { terms: ['Section 232'], alsoNeeds: 'aluminum' },
  'section-232-semiconductor-tariff': { terms: ['Section 232'], alsoNeeds: 'semiconductor' },
  'section-232-pharmaceutical-tariff': { terms: ['Section 232'], alsoNeeds: 'pharmaceutical' },
  'drc-cobalt-export-quota': { terms: ['cobalt export quota', 'cobalt export ban'] },
  'indonesia-nickel-ore-quota': { terms: ['nickel ore'], alsoNeeds: 'Indonesia' },
  'lower-mississippi-low-water': { terms: ['Mississippi River'], alsoNeeds: 'low water' },
  'jet-fuel-and-air-freight-costs': { terms: ['jet fuel'], alsoNeeds: 'air freight' },
  'us-advanced-chip-export-licensing': { terms: ['export license'], alsoNeeds: 'advanced computing' },
};
