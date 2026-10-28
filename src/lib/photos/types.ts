/**
 * Photo licences — the allow-list and the record every photo must carry.
 * Pure data, safe anywhere.
 *
 * Rule 3 (CLAUDE.md) was amended on 21 October 2026 to allow photographs, on
 * one condition: the site can show its right to use every one. The same idea
 * as the register (§6a): **a photo whose licence cannot be checked does not
 * render.** The loader in ./index.ts drops any entry missing a field its
 * licence requires, with a warning naming the photo.
 *
 * What is allowed, and why each is safe for a publication that may one day
 * charge for something:
 *
 *   own-work                     taken by someone on the masthead, or by a named
 *                                person who gave it to us (then use
 *                                written-permission instead).
 *   public-domain-us-government  made by a US federal employee as part of their
 *                                job: no copyright (17 U.S.C. § 105). Not every
 *                                image on a .gov site qualifies — contractors'
 *                                and agencies' third-party images keep theirs.
 *   public-domain                marked public domain by the rights holder or
 *                                the hosting archive (e.g. a Wikimedia Commons
 *                                "PD" tag), with the page that says so.
 *   cc0-1.0                      dedicated to the public domain by its author.
 *   cc-by-*, cc-by-sa-*          Creative Commons: credit the creator, link the
 *                                source and the licence, say if it was cropped.
 *   press-editorial              a port, canal or company press library whose
 *                                written terms allow editorial use. The terms
 *                                page is required.
 *   written-permission           the rights holder said yes in writing. Who and
 *                                when are required; keep the email.
 *
 * Not allowed, so not in the list: NonCommercial (NC) and NoDerivatives (ND)
 * Creative Commons licences, wire or agency photos (AP, Reuters, Getty, AFP,
 * Bloomberg), stock libraries, anything "found on Google" or social media,
 * screenshots of other people's work, and AI-generated images.
 */

export const PHOTO_LICENCES = {
  'own-work': { label: 'Own work', url: null },
  'public-domain-us-government': {
    label: 'Public domain (work of the US federal government)',
    url: 'https://www.govinfo.gov/content/pkg/USCODE-2020-title17/html/USCODE-2020-title17-chap1-sec105.htm',
  },
  'public-domain': { label: 'Public domain', url: 'https://creativecommons.org/publicdomain/mark/1.0/' },
  'cc0-1.0': { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'cc-by-2.0': { label: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/' },
  'cc-by-2.5': { label: 'CC BY 2.5', url: 'https://creativecommons.org/licenses/by/2.5/' },
  'cc-by-3.0': { label: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
  'cc-by-4.0': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa-2.0': { label: 'CC BY-SA 2.0', url: 'https://creativecommons.org/licenses/by-sa/2.0/' },
  'cc-by-sa-2.5': { label: 'CC BY-SA 2.5', url: 'https://creativecommons.org/licenses/by-sa/2.5/' },
  'cc-by-sa-3.0': { label: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  'cc-by-sa-4.0': { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  'press-editorial': { label: 'Press image, editorial use', url: null },
  'written-permission': { label: 'Used with permission', url: null },
} as const;

export type PhotoLicence = keyof typeof PHOTO_LICENCES;

export const PHOTO_LICENCE_IDS = Object.keys(PHOTO_LICENCES) as PhotoLicence[];

/** Licence ids people reach for that are deliberately refused, with the reason the warning gives. */
export const REFUSED_LICENCE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /-nc\b|noncommercial|non-commercial/i, reason: 'NonCommercial licences are refused: the site may not stay non-commercial.' },
  { pattern: /-nd\b|noderiv/i, reason: 'NoDerivatives licences are refused: even a crop can count as a change.' },
  { pattern: /getty|reuters|\bap\b|afp|bloomberg|shutterstock|alamy|stock/i, reason: 'Agency and stock photos are refused: they need a paid licence the site does not hold.' },
  { pattern: /\bai\b|generated|midjourney|dall-?e|stable diffusion/i, reason: 'AI-generated images are refused: the site shows real photographs only.' },
];

/** A photo as the site renders it, after its licence record has been checked. */
export interface Photo {
  /** Permanent, URL-safe. Pages refer to a photo by this. */
  id: string;
  /** Served from public/: always "/photos/<file>". No hotlinking. */
  src: string;
  width: number;
  height: number;
  /** What the photo shows, for screen readers. Under 125 characters. */
  alt: string;
  /** What, where and when. "File photo, 2023." if it is not current. */
  caption: string;
  /**
   * Ids of the tracked places this photo shows (src/lib/live/nodes.ts), e.g.
   * "hormuz". A register entry that lists the same place in its `places` gets
   * this photo with no per-entry edit, so a new entry about a place the site
   * already has a photo of picks it up, and one about a place it has none of
   * simply shows none. Empty when the photo is not tied to a place.
   */
  places: string[];
  credit: {
    creator: string;
    /** The work's own title, if it has one. */
    title: string | null;
    /** The page where the licence is stated (not the image file). Null only for own work. */
    sourceUrl: string | null;
    licence: PhotoLicence;
    licenceLabel: string;
    licenceUrl: string | null;
    /** e.g. "Cropped from the original." Null if shown unchanged. */
    modification: string | null;
  };
}

export interface PhotoDiagnostics {
  photos: Photo[];
  warnings: string[];
}
