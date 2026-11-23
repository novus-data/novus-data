import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const baseClasses =
  'text-link underline decoration-[color-mix(in_srgb,var(--accent-text)_45%,transparent)] decoration-1 underline-offset-[0.2em] transition-colors hover:decoration-[var(--accent-text)]';

/**
 * For a link that is the whole of its paragraph: a call to action closing a
 * section, rather than a word inside a sentence.
 *
 * WCAG 2.5.8 exempts an inline link from the 44px target size, and rightly so
 * — the sentence around it is not clickable, and growing the link to suit a
 * finger would wreck the line. A link sitting alone in its own paragraph has
 * no such excuse. It is a control, and it gets a control's target: at 17px
 * tall these were roughly a third of the height a thumb is assumed to need.
 *
 * The extra height is added above and below the text rather than under it, so
 * the underline stays exactly where the type sets it and nothing moves
 * optically. Call sites pair this with a smaller top margin, because the box
 * now supplies the space the margin used to.
 */
const standaloneClasses = 'inline-flex min-h-11 items-center';

/** Internal link, styled once so every link on the site matches. */
export function TextLink({
  className,
  children,
  standalone,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode; standalone?: boolean }) {
  return (
    <Link
      className={clsx(baseClasses, standalone && standaloneClasses, className)}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * A mail address. Deliberately not an ExternalLink: `mailto:` hands off to the
 * reader's mail client, so target="_blank" would leave an empty tab behind and
 * rel="noopener" means nothing.
 */
export function MailLink({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  return (
    <a href={`mailto:${email}`} className={clsx(baseClasses, className)}>
      {email}
    </a>
  );
}

/**
 * A `mailto:` link with its own words ("Email"), for a message the reader
 * writes, such as passing a page on. Not an ExternalLink, for MailLink's
 * reason above.
 */
export function MailtoLink({
  href,
  children,
  className,
}: {
  href: `mailto:${string}`;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={clsx(baseClasses, className)}>
      {children}
    </a>
  );
}

/** Outbound link. Always rel-hardened; never opens a tab silently. */
export function ExternalLink({
  className,
  children,
  standalone,
  ...props
}: ComponentProps<'a'> & { children: ReactNode; standalone?: boolean }) {
  return (
    <a
      className={clsx(baseClasses, standalone && standaloneClasses, className)}
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}
