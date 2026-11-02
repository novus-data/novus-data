import type { Metadata } from 'next';

import { publication } from '@/config/publication';
import { absoluteUrl } from '@/lib/env';

/**
 * The locale every page declares. One constant, so the layout and the pages
 * cannot disagree.
 */
export const OPEN_GRAPH_LOCALE = 'en_GB';

/**
 * Metadata for an ordinary reading page: title, description, canonical URL and
 * the tags that decide how a shared link previews.
 *
 * Why this exists. A page that sets its own `title` but no `openGraph` inherits
 * the layout's `openGraph` whole, so every such page used to preview as plain
 * "Novus Data" with the site description, whatever the page was about. A page
 * that sets `openGraph` replaces the layout's object entirely, so the fields
 * the layout supplies (site name, locale, card type) have to be repeated. This
 * does both in one place. /mancale and /entities predate it and set their own;
 * they are correct and are left alone.
 *
 * `title` is the short page name ("About"); the preview title appends the
 * publication name because a link preview is read away from the site.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(path);
  const shareTitle = `${title} — ${publication.name}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: publication.name,
      title: shareTitle,
      description,
      url,
      locale: OPEN_GRAPH_LOCALE,
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description },
  };
}
