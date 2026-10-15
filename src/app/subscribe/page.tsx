import type { Metadata } from 'next';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { StoryBox } from '@/components/story-box';
import { SubscribePanel } from '@/components/subscribe-panel';
import { ExternalLink, TextLink } from '@/components/text-link';
import { subscribeVia } from '@/config/launch';
import { publication } from '@/config/publication';
import { absoluteUrl, env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Subscribe',
  description: `Get ${publication.name} by email.`,
  alternates: { canonical: absoluteUrl('/subscribe') },
};

export default function SubscribePage() {
  return (
    <>
      <PageHeader
        width="reading"
        title="Subscribe"
        lede={`${publication.description} Each issue arrives by email.`}
      />

      <Container width="reading" className="mt-8 flex flex-col gap-5">
        <SubscribePanel heading="Subscribe by email" />

        <StoryBox as="section" level={2} id="how" kicker="How it works" kickerTone="muted" title="What happens to your address">
          {subscribeVia === 'mailto' && env.contactEmail ? (
            <p>
              Subscribing sends an email to {env.contactEmail}. I add your address to Beehiiv
              by hand, so the first briefing may not arrive straight away. Beehiiv then sends the
              emails and holds the list, and every issue carries an unsubscribe link. Your message
              stays in that mailbox until I have added you; email the same address to ask for it
              to be deleted.
            </p>
          ) : (
            <p>
              Subscriptions are handled by Beehiiv, which sends the emails and holds the list.
              Your address goes to Beehiiv and nowhere else, and every issue carries an
              unsubscribe link.
            </p>
          )}
          <p>
            This site does not run analytics or set cookies of its own.{' '}
            <TextLink href="/privacy">What that means in practice</TextLink>.
          </p>
          {env.beehiivFeedUrl ? (
            <p>
              If you would rather not use email, the same issues are available by{' '}
              <ExternalLink href={env.beehiivFeedUrl}>RSS</ExternalLink>, and the full archive is
              on this site under <TextLink href="/briefings">Briefings</TextLink>.
            </p>
          ) : (
            <p>
              The full archive is also readable here, without subscribing, under{' '}
              <TextLink href="/briefings">Briefings</TextLink>.
            </p>
          )}
        </StoryBox>
      </Container>
    </>
  );
}
