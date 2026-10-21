/**
 * The photo register: `content/photos/photos.json`, checked against
 * ./types.ts. Server-only (reads files). Pages call `getPhoto(id)` and pass
 * the result to <CreditedPhoto>; a photo that fails its check is simply not
 * there, so no page can show one without its credit.
 *
 * Each entry in the file:
 *
 *   {
 *     "id": "hormuz-tanker-2019",              permanent, URL-safe
 *     "file": "hormuz-tanker-2019.jpg",        in public/photos/, jpg/png/webp
 *     "width": 1280, "height": 853,            pixels, so the page does not jump
 *     "alt": "A tanker passes through ...",    under 125 characters
 *     "caption": "A tanker in the Strait of Hormuz. File photo, 2019.",
 *     "creator": "U.S. Navy photo by ...",     exactly as the source asks
 *     "title": null,                           the work's own title, if any
 *     "sourceUrl": "https://commons.wikimedia.org/wiki/File:...",
 *     "licence": "public-domain-us-government",   one id from PHOTO_LICENCES
 *     "modification": null,                    or "Cropped from the original."
 *     "retrievedAt": "2026-10-21",             the day the licence was checked
 *     "termsUrl": null,                        required for press-editorial
 *     "permission": null                       { "from": "...", "date": "YYYY-MM-DD" } for written-permission
 *   }
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ID_PATTERN } from '@/lib/disruptions/types';
import { isHttpUrl } from '@/lib/url';

import {
  PHOTO_LICENCES,
  REFUSED_LICENCE_PATTERNS,
  type Photo,
  type PhotoDiagnostics,
  type PhotoLicence,
} from './types';

export * from './types';

const PHOTOS_FILE = path.join(process.cwd(), 'content', 'photos', 'photos.json');
const PUBLIC_PHOTOS = path.join(process.cwd(), 'public', 'photos');
const FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function check(raw: Record<string, unknown>, index: number, warnings: string[]): Photo | null {
  const label = typeof raw.id === 'string' ? raw.id : `entry ${index + 1}`;
  const refuse = (why: string) => {
    warnings.push(`Refused photo ${label}: ${why}`);
    return null;
  };

  const id = text(raw.id);
  if (!id || !ID_PATTERN.test(id)) return refuse('id must be lowercase letters, digits and single hyphens.');
  const file = text(raw.file);
  if (!file || !FILE_PATTERN.test(file)) return refuse('file must be a lowercase .jpg, .png or .webp name in public/photos/.');
  if (!existsSync(path.join(PUBLIC_PHOTOS, file))) return refuse(`public/photos/${file} does not exist.`);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (!(width > 0 && height > 0)) return refuse('width and height (in pixels) are required.');
  const alt = text(raw.alt);
  if (!alt || alt.length > 125) return refuse('alt text is required and must be under 125 characters.');
  const caption = text(raw.caption);
  if (!caption) return refuse('a caption saying what, where and when is required.');
  const creator = text(raw.creator);
  if (!creator) return refuse('the creator is required, credited exactly as the source asks.');
  if (typeof raw.retrievedAt !== 'string' || !ISO_DAY.test(raw.retrievedAt)) {
    return refuse('retrievedAt (the day the licence was checked, "YYYY-MM-DD") is required.');
  }

  const licenceRaw = text(raw.licence) ?? '';
  if (!(licenceRaw in PHOTO_LICENCES)) {
    const refused = REFUSED_LICENCE_PATTERNS.find((entry) => entry.pattern.test(licenceRaw));
    return refuse(refused ? refused.reason : `"${licenceRaw}" is not an allowed licence (see PHOTO_LICENCES).`);
  }
  const licence = licenceRaw as PhotoLicence;

  const sourceUrl = text(raw.sourceUrl);
  if (licence !== 'own-work' && (!sourceUrl || !isHttpUrl(sourceUrl))) {
    return refuse('sourceUrl (the page that states the licence) is required for anything that is not own work.');
  }
  if (licence === 'press-editorial') {
    const terms = text(raw.termsUrl);
    if (!terms || !isHttpUrl(terms)) return refuse('press-editorial needs termsUrl: the page whose terms allow editorial use.');
  }
  if (licence === 'written-permission') {
    const permission = (raw.permission ?? {}) as Record<string, unknown>;
    if (!text(permission.from) || typeof permission.date !== 'string' || !ISO_DAY.test(permission.date)) {
      return refuse('written-permission needs permission.from and permission.date. Keep the email.');
    }
  }

  const terms = PHOTO_LICENCES[licence];
  return {
    id,
    src: `/photos/${file}`,
    width,
    height,
    alt,
    caption,
    credit: {
      creator,
      title: text(raw.title),
      sourceUrl: sourceUrl && isHttpUrl(sourceUrl) ? sourceUrl : null,
      licence,
      licenceLabel: terms.label,
      licenceUrl: licence === 'press-editorial' ? text(raw.termsUrl) : terms.url,
      modification: text(raw.modification),
    },
  };
}

let cached: Promise<PhotoDiagnostics> | null = null;

export function readPhotos(): Promise<PhotoDiagnostics> {
  cached ??= (async () => {
    const warnings: string[] = [];
    let entries: unknown[] = [];
    try {
      const file = JSON.parse(await readFile(PHOTOS_FILE, 'utf8')) as { photos?: unknown[] };
      entries = Array.isArray(file.photos) ? file.photos : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        warnings.push(`content/photos/photos.json could not be read: ${(error as Error).message}`);
      }
    }
    const photos: Photo[] = [];
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const photo = check((entry ?? {}) as Record<string, unknown>, index, warnings);
      if (!photo) return;
      if (seen.has(photo.id)) {
        warnings.push(`Refused photo ${photo.id}: the id is used twice.`);
        return;
      }
      seen.add(photo.id);
      photos.push(photo);
    });
    for (const warning of warnings) console.warn(`[photos] ${warning}`);
    return { photos, warnings };
  })();
  return cached;
}

/** A checked photo, or null if it does not exist or failed its licence check. */
export async function getPhoto(id: string): Promise<Photo | null> {
  const { photos } = await readPhotos();
  return photos.find((photo) => photo.id === id) ?? null;
}
