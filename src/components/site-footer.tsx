import clsx from 'clsx';
import Link from 'next/link';

import { Container } from '@/components/container';
import { Wordmark } from '@/components/wordmark';
import { footerGroups } from '@/config/nav';
import { publication } from '@/config/publication';
import { env } from '@/lib/env';

const FOOTER_LINK =
  'inline-flex min-h-11 items-center text-[0.9375rem] text-muted transition-colors hover:text-fg';

/** Marks a link that leaves the site. Inline SVG, per the no-icon-library rule. */
function ExternalArrow() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8 8 3M4 3h4v4" />
    </svg>
  );
}

export function SiteFooter() {
  // Computed at render. The site is statically generated, so in practice this
  // is the year of the most recent deploy — and issues deploy regularly.
  const year = new Date().getUTCFullYear();

  const externalLinks = [
    env.beehiivHomeUrl ? { href: env.beehiivHomeUrl, label: 'Read on Beehiiv' } : null,
    env.beehiivFeedUrl ? { href: env.beehiivFeedUrl, label: 'RSS feed' } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <footer className="mt-24 border-t border-hairline print:mt-8">
      <Container className="py-12 sm:py-16 print:py-5">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-16">
          <div className="max-w-sm">
            <Wordmark className="text-[1.125rem]" />
            <p className="mt-3 text-[0.9375rem] text-muted">{publication.shortDescription}</p>
          </div>

          {/* Hidden in print. Everything in here is a link, and a link is
              the one thing paper cannot honour — whereas the wordmark and the
              disclaimer below are exactly what a forwarded page needs. */}
          <nav aria-label="Footer" className="print:hidden">
            {/* Three headed lists rather than one grid of fourteen links. Every
                link is still a 44px tap target (min-h-11). The two outside
                links sit in "Writing" and are styled like their neighbours, so
                the list reads as one list; the arrow is what says they leave
                the site. */}
            <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
              {footerGroups.map((group) => (
                <div key={group.heading}>
                  <p className="kicker kicker-muted">{group.heading}</p>
                  <ul className="mt-2">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className={FOOTER_LINK}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                    {group.heading === 'Writing'
                      ? externalLinks.map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              rel="noopener noreferrer"
                              target="_blank"
                              className={clsx(FOOTER_LINK, 'gap-1.5')}
                            >
                              {link.label}
                              <ExternalArrow />
                            </a>
                          </li>
                        ))
                      : null}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-12 border-t border-hairline pt-6">
          <p className="text-meta text-muted">{publication.disclaimer}</p>
          <p className="mt-2 text-meta text-muted">
            <span data-numeric>&copy; {year}</span> {publication.name}
          </p>
        </div>
      </Container>
    </footer>
  );
}
