'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { Container } from '@/components/container';
import { Wordmark } from '@/components/wordmark';
import { primaryNav } from '@/config/nav';

/**
 * The masthead row and the mobile menu.
 *
 * This is the site's only client component. It needs to be one because the
 * mobile menu opens and closes, and because `aria-current` needs the active
 * pathname, which server components cannot read. Everything else renders on
 * the server.
 *
 * The open menu sits in the document flow and pushes the page down rather than
 * floating over it. The header is not sticky, so there is nothing to gain from
 * an overlay, and an overlay clipping the first line of a headline reads like a
 * rendering fault. In flow there is no absolute positioning and no z-index to
 * reason about.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navigatedFrom, setNavigatedFrom] = useState(pathname);
  const panelId = useId();

  // Close the menu after navigating. Client-side navigation keeps this
  // component mounted, so without this the panel would stay open on the new
  // page. Adjusting state during render — rather than in an effect — is the
  // documented way to reset state when a prop-like value changes, and avoids
  // the extra render pass an effect would cost.
  if (pathname !== navigatedFrom) {
    setNavigatedFrom(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
        <Link href="/" className="inline-flex items-center py-2">
          <Wordmark className="text-[1.1875rem] sm:text-[1.25rem]" />
          <span className="sr-only">— home</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
        <nav aria-label="Primary">
          <ul className="flex items-center gap-7">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={clsx(
                    'inline-flex min-h-11 items-center text-[0.9375rem] transition-colors',
                    isActive(item.href)
                      ? 'text-fg underline decoration-accent decoration-2 underline-offset-[0.45em]'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {item.label}
                  {item.suffix ? <span className="hidden lg:inline">&nbsp;{item.suffix}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* The one filled control in the header. It appears from `lg` up: at
            768px the seven links already fill the row. Below that, and in
            between, the mobile menu and the page's own strip carry it. */}
        <Link
          href="/subscribe"
          aria-current={isActive('/subscribe') ? 'page' : undefined}
          className="hidden min-h-10 items-center border border-link bg-link px-4 text-[0.9375rem] font-medium text-surface transition-colors hover:border-fg hover:bg-fg lg:inline-flex"
        >
          Subscribe
        </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="-mr-2 inline-flex min-h-11 min-w-11 items-center gap-2 px-2 text-[0.9375rem] text-fg md:hidden"
        >
          <MenuIcon open={open} />
          {open ? 'Close' : 'Menu'}
        </button>
      </Container>

      <div id={panelId} hidden={!open} className="border-t border-hairline md:hidden">
        <Container>
          <nav aria-label="Primary, mobile">
            <ul className="flex flex-col pb-3">
              {primaryNav.map((item) => (
                <li key={item.href} className="border-t border-hairline first:border-t-0">
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-12 items-center text-[1.0625rem]',
                      isActive(item.href) ? 'text-fg' : 'text-muted',
                    )}
                  >
                    {item.label}
                    {item.suffix ? ` ${item.suffix}` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-hairline py-3">
            <Link
              href="/subscribe"
              className="flex min-h-12 items-center justify-center border border-link bg-link text-[1.0625rem] font-medium text-surface"
            >
              Get the free briefing
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}

/** Inline SVG, per the no-icon-library and no-emoji rules. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      {open ? (
        <>
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </>
      ) : (
        <>
          <line x1="2" y1="4.5" x2="14" y2="4.5" />
          <line x1="2" y1="11.5" x2="14" y2="11.5" />
        </>
      )}
    </svg>
  );
}
