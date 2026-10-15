import { ExternalActionLink, MailActionLink, UnavailableAction } from '@/components/action';
import { StoryBox } from '@/components/story-box';
import { subscribeVia } from '@/config/launch';
import { publication } from '@/config/publication';
import { env } from '@/lib/env';
import { subscribeMailto } from '@/lib/subscribe';

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
}: {
  heading?: string;
  level?: 2 | 3;
  className?: string;
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
      <ExternalActionLink href={env.subscribeUrl}>Subscribe on Beehiiv</ExternalActionLink>
    </div>
  ) : (
    <div>
      <UnavailableAction>Subscribe on Beehiiv</UnavailableAction>
      <p className="mt-3 max-w-[52ch] text-meta text-muted">
        No subscribe link is configured yet. Set{' '}
        <code className="[overflow-wrap:anywhere]">NEXT_PUBLIC_BEEHIIV_SUBSCRIBE_URL</code> to
        enable this.
      </p>
    </div>
  );

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
