import clsx from 'clsx';

import { ExternalLink, MailtoLink } from '@/components/text-link';
import { absoluteUrl } from '@/lib/env';

/**
 * "Share: LinkedIn · X · Email" under a post or a register entry.
 *
 * Plain links on purpose. The networks' own share buttons load their scripts
 * and set their cookies for every reader who merely sees them, which would
 * make /privacy untrue and add the site's first third-party script. A plain
 * link sends nothing to anyone until a reader clicks it, and then only the
 * page's address and title, to the service the reader chose.
 *
 * The way to pass a page on sits where a reader finishes it. Hidden in print,
 * where a link cannot be followed; the printed page carries its permanent
 * address instead (PrintPermalink).
 */
export function ShareLinks({
  path,
  title,
  className,
}: {
  /** Site-relative path of the page being shared. */
  path: string;
  title: string;
  className?: string;
}) {
  const url = absoluteUrl(path);
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const x = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const email = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` as const;

  return (
    <p className={clsx('text-meta text-muted print:hidden', className)}>
      Share: <ExternalLink href={linkedIn}>LinkedIn</ExternalLink>
      {' · '}
      <ExternalLink href={x}>X</ExternalLink>
      {' · '}
      <MailtoLink href={email}>Email</MailtoLink>
    </p>
  );
}
