import clsx from 'clsx';

import { ExternalActionLink, MailActionLink, UnavailableAction } from '@/components/action';
import { StoryBox } from '@/components/story-box';
import { subscribeVia } from '@/config/launch';
import { publication } from '@/config/publication';
import { env } from '@/lib/env';
import { subscribeMailto } from '@/lib/subscribe';

/**
 * What the button says. It names the thing the reader gets, not the vendor that
 * delivers it: "Subscribe on Beehiiv" asks a reader to know what Beehiiv is.
 * The footer line under the panel still says who sends the emails.
 */
const SUBSCRIBE_LABEL = 'Get the free briefing';

/**
 * Subscribing happens on Beehiiv, which owns delivery, the subscriber list and
 * compliance. The site's job is to make the step obvious and get out of the
 * way. There is deliberately no email field here: with no backend, a form
 * would discard addresses silently, which is worse than no form.
 */
export function SubscribePanel({
  heading = 'Subscribe',
  level = 2,
  className,
  strip = false,
}: {
  heading?: string;
  level?: 2 | 3;
  className?: string;
  /**
   * One slim row for the top of a page: the same facts and the same button,
   * with its own anchor id so a page can carry it and the full panel below
   * without two elements sharing `#subscribe`. It replaced a compact box that
   * was about as tall as the lead story's headline on a phone.
   */
  strip?: boolean;
}) {
  // Only ever states a schedule that has actually been committed to.
  const cadenceLine = publication.cadence
    ? `Published ${publication.cadence}, by email. Free.`
    : 'Delivered by email. Free.';

  // While subscribeVia is 'mailto' (launch.ts), subscribing is an email to the
  // contact address; the address is also printed, for readers with no mail app.
  const byEmail = subscribeVia === 'mailto' && env.contactEmail ? env.contactEmail : null;

  const action = byEmail ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <MailActionLink href={subscribeMailto(byEmail)}>Subscribe by email</MailActionLink>
      <span className="text-meta text-muted [overflow-wrap:anywhere]">{byEmail}</span>
    </div>
  ) : env.subscribeUrl ? (
    <div>
      <ExternalActionLink href={env.subscribeUrl}>{SUBSCRIBE_LABEL}</ExternalActionLink>
    </div>
  ) : (
    <div>
      <UnavailableAction>{SUBSCRIBE_LABEL}</UnavailableAction>
      <p className="mt-3 max-w-[52ch] text-meta text-muted">
        No subscribe link is configured yet. Set{' '}
        <code className="[overflow-wrap:anywhere]">NEXT_PUBLIC_BEEHIIV_SUBSCRIBE_URL</code> to
        enable this.
      </p>
    </div>
  );

  if (strip) {
    return (
      <section
        id="subscribe-top"
        aria-label={`Subscribe to ${publication.newsletter.name}`}
        className={clsx(
          'flex flex-col gap-3 border border-rule bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5',
          className,
        )}
      >
        <p className="max-w-measure text-[0.9375rem] text-muted">
          <span className="font-semibold text-fg">{publication.newsletter.name}</span>
          <span aria-hidden="true" className="hidden sm:inline">
            {' '}
            &middot;{' '}
          </span>
          <span className="block sm:inline">{cadenceLine}</span>
        </p>
        <div className="shrink-0">{action}</div>
      </section>
    );
  }

  return (
    <StoryBox
      as="section"
      id="subscribe"
      level={level}
      kicker={publication.newsletter.name}
      title={heading}
      className={className}
      footer={
        byEmail ? (
          <span>
            I add each address to the list by hand, so the first briefing may not arrive straight
            away. Beehiiv then sends the emails. Every issue carries an unsubscribe link.
          </span>
        ) : (
          <span>
            Your address goes to Beehiiv, which sends the emails. Every issue carries an unsubscribe
            link.
          </span>
        )
      }
    >
      <p>{cadenceLine}</p>
      {action}
    </StoryBox>
  );
}
