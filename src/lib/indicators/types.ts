/**
 * The indicators layer — types and labels. Pure data, safe anywhere.
 *
 * This is the third typed layer that CLAUDE.md §14.1 reserved for "live
 * indicator data — a freight rate, a transit count, a price". Its first and
 * only indicator is the Mancalë Index. Components take labels from here and
 * data as props; only pages import the layer index, which reads files.
 *
 * The three things §14.1 says must be decided before an indicator is drawn:
 *
 *   source       every chokepoint carries the IMF PortWatch citation, and the
 *                GDELT citation once its news volume has been collected.
 *   as-of        `dataThrough` is the last day inside the upstream ship data,
 *                never the day the refresh script happened to run.
 *   when stale   older than MANCALE_METHOD.staleAfterDays at build, the page
 *                says it had not been refreshed and prints the absolute date.
 */

import type { Source } from '@/lib/disruptions/types';

export type { Source };

/** Every label a week can carry. Order is the order the page explains them in. */
export const MANCALE_REGIMES = [
  'narrative-led',
  'aligned',
  'reality-led',
  'quiet',
  'flow-only-normal',
  'flow-only-elevated',
  'flow-only-severe',
  'flow-only-surge',
] as const;

export type MancaleRegime = (typeof MANCALE_REGIMES)[number];

export const MANCALE_REGIME_LABELS: Record<MancaleRegime, string> = {
  'narrative-led': 'News ahead of ships',
  aligned: 'Aligned',
  'reality-led': 'Ships ahead of news',
  quiet: 'Quiet',
  'flow-only-normal': 'Ships normal',
  'flow-only-elevated': 'Ships disrupted',
  'flow-only-severe': 'Ships severely disrupted',
  'flow-only-surge': 'Ships above normal',
};

/** One plain sentence per label, for the page's key. */
export const MANCALE_REGIME_MEANINGS: Record<MancaleRegime, string> = {
  'narrative-led': 'Coverage is far more unusual than the ship traffic. The news is louder than the ships justify.',
  aligned: 'Coverage and ship traffic are about equally unusual. The news and the ships tell the same story.',
  'reality-led': 'Ship traffic is far more disrupted than the coverage suggests. The ships are ahead of the news.',
  quiet: 'Neither coverage nor ship traffic is unusual.',
  'flow-only-normal': 'No news volume collected yet. Ship traffic is within its normal range.',
  'flow-only-elevated': 'No news volume collected yet. Ship traffic is clearly below normal.',
  'flow-only-severe': 'No news volume collected yet. Ship traffic is far below normal.',
  'flow-only-surge': 'No news volume collected yet. Ship traffic is clearly above normal, which can mean ships diverted here from elsewhere.',
};

/** One week of one chokepoint, after scoring. Every score is null when its input is. */
export interface MancaleWeek {
  /** Monday that opens the week, "YYYY-MM-DD". Weeks run Monday to Sunday. */
  weekStart: string;
  /** Mean daily vessel transits that week (IMF PortWatch). */
  transitsPerDay: number;
  /** Against the frozen baseline: -95 is 95% below normal. */
  flowVsBaselinePct: number;
  /** 0–6. How unusually few ships passed. Downside only. */
  flowStress: number;
  /** 0–6. How unusually many ships passed. Kept apart from stress. */
  flowSurge: number;
  /** Mean daily share of monitored English-language coverage, in percent (GDELT). */
  newsSharePct: number | null;
  /** newsSharePct as a multiple of its baseline. 1 is normal. */
  newsXBaseline: number | null;
  /** 0–6. How unusually loud the coverage was. Upside only. */
  attention: number | null;
  /** attention minus flowStress. */
  gap: number | null;
  regime: MancaleRegime;
}

export interface MancaleChokepoint {
  id: string;
  label: string;
  /** The chokepoint's name in IMF PortWatch, quoted so a reader can find the same series. */
  portwatchName: string;
  /** The GDELT query, or null while no news volume has been collected. */
  newsQuery: string | null;
  hasNews: boolean;
  baselineTransitsPerDay: number;
  baselineNewsSharePct: number | null;
  weeks: MancaleWeek[];
  latest: MancaleWeek;
  /** Consecutive weeks, including the latest, with the latest week's label. */
  weeksInRegime: number;
  /** The loudest week of coverage in the series, or null without news. */
  newsPeak: { weekStart: string; sharePct: number } | null;
  /** The data-quality note to read before quoting this chokepoint's numbers. */
  note: string;
  sources: Source[];
}

export interface MancaleIndex {
  /** Version of the method that scored this data. Printed on the page. */
  version: string;
  /** Last day inside the upstream ship data, "YYYY-MM-DD". The as-of date. */
  dataThrough: string;
  /** Monday of the latest full week. */
  latestWeekStart: string;
  /** True when dataThrough was older than the stale window when this page was built. */
  staleAtBuild: boolean;
  chokepoints: MancaleChokepoint[];
  /** Chokepoints dropped or values corrected at load time, each naming why. */
  warnings: string[];
}
