import Image from 'next/image';

import { ExternalLink } from '@/components/text-link';
import type { Photo } from '@/lib/photos/types';

/**
 * A photograph with its credit, always. The only way a page shows a photo.
 *
 * It takes a `Photo`, which only exists once ./lib/photos has checked the
 * licence record, so there is no way to render an uncredited image through
 * here. The credit follows Creative Commons' recommended form — title,
 * author, source, licence, and any change — which also satisfies the plainer
 * licences. Files are served from public/photos/, never hotlinked (Rule 3).
 */
export function CreditedPhoto({ photo, priority = false }: { photo: Photo; priority?: boolean }) {
  const { credit } = photo;
  return (
    <figure className="flex flex-col gap-2">
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        priority={priority}
        sizes="(min-width: 1088px) 1024px, 100vw"
        className="h-auto w-full border border-hairline"
      />
      <figcaption className="flex flex-col gap-0.5 text-muted">
        <span className="text-meta leading-relaxed text-fg">{photo.caption}</span>
        <span className="text-xs leading-snug">
          Photo: {credit.title ? <>&ldquo;{credit.title}&rdquo; by </> : null}
          {credit.creator}
          {credit.sourceUrl ? (
            <>
              {' '}
              (<ExternalLink href={credit.sourceUrl}>source</ExternalLink>)
            </>
          ) : null}
          ,{' '}
          {credit.licenceUrl ? (
            <ExternalLink href={credit.licenceUrl}>{credit.licenceLabel}</ExternalLink>
          ) : (
            credit.licenceLabel
          )}
          .{credit.modification ? ` ${credit.modification}` : ''}
        </span>
      </figcaption>
    </figure>
  );
}
