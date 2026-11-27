import type { Metadata } from 'next';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { StoryBox } from '@/components/story-box';
import { SubscribePanel } from '@/components/subscribe-panel';
import { TextLink } from '@/components/text-link';
import { publication } from '@/config/publication';
import { absoluteUrl } from '@/lib/env';
import { formatLongDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Alerts',
  description: `${publication.alerts.name}: planned notifications for changes in the disruption register.`,
  alternates: { canonical: absoluteUrl('/alerts') },
};

/**
 * The alerts app does not exist yet. This page says so in the first sentence.
 *
 * Announcing an unbuilt product as though it shipped is the fastest way to lose
 * the reader this site is written for, so the copy is written in the future
 * tense throughout and there is no waiting-list form — the email briefing is
 * the channel that actually exists today.
 */
export default function AlertsPage() {
  const available = formatLongDate(publication.alerts.availableFrom);

  return (
    <>
      <PageHeader
        width="reading"
        title={publication.alerts.name}
        lede="Notifications when something in the register changes. The app is not built yet, but following by feed works today."
      />

      <Container width="reading" className="mt-8 flex flex-col gap-5">
        <StoryBox
          as="section"
          level={2}
          id="now"
          kicker="Available now"
          title="Follow by feed"
          footer={<TextLink href="/follow">Every feed: companies, industries, places and the whole register</TextLink>}
        >
          <p>
            Every company, sector, industry and place in the register has its own feed. Add one to a
            feed reader, or to a service that emails you a feed&rsquo;s new items, and a new item
            appears when a disruption starts to reach it, changes status, or is assessed
            differently. No account, and nothing stored about you: your feed reader keeps the list.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="will" kicker="Scope" kickerTone="muted" title="What the app will add">
          <p>
            The feeds already tell you when the register changes. The app will add notifications on
            your phone and one place to keep everything you follow, without a separate feed reader.
          </p>
          <p>
            The first version will notify on facts this site can already prove: a new entry in
            the register, a change of status, or a new company added to a disruption. Anything
            derived, such as a threshold crossed or a forecast, comes later if at all, and only
            once the underlying record has been visibly right for a while.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="will-not" kicker="Limits" kickerTone="muted" title="What it will not do">
          <p>
            It will not send trade signals, price targets or recommendations. It is a change
            notification on a public record, and the record is analysis and commentary, not
            investment advice.
          </p>
          <p>
            It will not be noisy by default. A notification is a much stronger claim on your
            attention than an email, and an alert that turns out to be stale costs more trust
            than the same error inside a written briefing. That argues for a narrow, quiet first
            version.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="privacy" kicker="Privacy" kickerTone="muted" title="What an app would have to store">
          <p>
            This site currently stores nothing about you: no analytics and no cookies of its own,
            and following by feed does not change that. An alerts app cannot make that claim,
            because it has to keep a device identifier and your preferences somewhere.
          </p>
          <p>
            When alerts ship, <TextLink href="/privacy">the privacy page</TextLink> will be
            rewritten in the same release to describe exactly what is held and why, not
            afterwards.
          </p>
        </StoryBox>

        <StoryBox as="section" level={2} id="until-then" kicker="Timing" kickerTone="muted" title="Until then">
          {available ? (
            <p>
              Alerts are expected from <time>{available}</time>.
            </p>
          ) : (
            <p>
              There is no announced date. When there is one, it will be stated here and in the
              briefing rather than implied.
            </p>
          )}
          <p>
            Until then, follow by feed, or take the email briefing. Subscribers will hear about the
            app first.
          </p>
        </StoryBox>
      </Container>

      <Container width="reading" className="mt-5">
        <SubscribePanel heading="Get the briefing while alerts are built" />
      </Container>
    </>
  );
}
