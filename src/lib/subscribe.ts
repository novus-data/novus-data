import { publication } from '@/config/publication';

/**
 * The one subscribe-by-email link, so its subject and body are defined once.
 * Sending it from the address being subscribed is the evidence that its owner
 * asked, which a typed-in address on a form would not be.
 */
export function subscribeMailto(email: string): string {
  const subject = encodeURIComponent('Subscribe');
  const body = encodeURIComponent(`Please add me to ${publication.newsletter.name}.`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
