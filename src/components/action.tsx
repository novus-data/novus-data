import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The site's buttons: square-cornered boxes, never rounded pills, so they read
 * as controls in a publication rather than calls to action in an ad.
 *
 * Three weights, and only one of them is loud. `primary` is solid navy and is
 * for the one thing the site wants a reader to do: subscribe. `secondary` is
 * the old outlined box, for "read this story" links inside a box. `quiet` is a
 * hairline outline for a third option beside one of those. Two solid buttons
 * on one screen would compete, which is why the lead story's links are not
 * primary.
 *
 * Tap target is at least 44px tall at every size (py-3 + line height).
 */
const shared =
  'inline-flex min-h-[2.875rem] items-center justify-center border px-5 py-3 font-sans text-[0.9375rem] font-medium transition-colors';

// Secondary sits on --surface-2 so it still reads as a control inside a story
// box, which is itself --surface. Primary is --accent-text (the link colour,
// 9.4:1 against white text) so a filled button and a link are the same blue.
const variants = {
  primary: 'border-link bg-link text-surface hover:border-fg hover:bg-fg',
  secondary: 'border-accent bg-surface-2 text-fg hover:border-link',
  quiet: 'border-rule bg-transparent text-fg hover:bg-surface-2 hover:border-accent',
} as const;

export type ActionVariant = keyof typeof variants;

export function ActionLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ActionVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={clsx(shared, variants[variant], className)}>
      {children}
    </Link>
  );
}

export function ExternalActionLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ActionVariant;
  className?: string;
}) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className={clsx(shared, variants[variant], className)}
    >
      {children}
    </a>
  );
}

/** A button that opens the reader's mail client. No target: a new tab would be left empty. */
export function MailActionLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ActionVariant;
  className?: string;
}) {
  return (
    <a href={href} className={clsx(shared, variants[variant], className)}>
      {children}
    </a>
  );
}

/**
 * Shown in place of a subscribe control when no subscribe URL is configured.
 * A disabled control that explains itself beats a button that goes nowhere.
 */
export function UnavailableAction({ children }: { children: ReactNode }) {
  return (
    <span
      className={clsx(
        shared,
        'cursor-not-allowed border-dashed border-accent bg-transparent text-muted',
      )}
      aria-disabled="true"
    >
      {children}
    </span>
  );
}
