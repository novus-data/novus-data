/**
 * Launch gates for sections that are not approved for the public launch.
 *
 * Two switches, not one, because DECISIONS.md launches them separately:
 * articles go live once the first one is finished, so the section never opens
 * empty; the monitor is a new kind of data and needs its own decision. Turning
 * either on needs Gavin and Alex to agree, recorded in DECISIONS.md.
 */
export const articlesEnabled = true;
export const monitorEnabled = false;

/**
 * The Mancalë Index (/mancale), added 21 October 2026 and switched on by Alex
 * on 25 October 2026 (DECISIONS.md, "The Mancalë Index"). It also gates
 * /mancale/scorecard. Set to false to take both down: they then 404 and no
 * navigation links to them.
 */
export const mancaleEnabled = true;

/**
 * Where subscribe buttons send a reader. 'beehiiv-link' is the original:
 * Beehiiv's hosted sign-up. 'mailto' is a temporary workaround agreed on
 * 15 October 2026 (DECISIONS.md) while Beehiiv's sign-up was losing test
 * sign-ups: the button opens an email to the contact address and the editor
 * adds the sender to Beehiiv by hand. The site stores nothing either way.
 *
 * Revert to 'beehiiv-link' once a fresh test address completes Beehiiv's own
 * sign-up and appears in Audience. With no contact address configured,
 * 'mailto' falls back to the Beehiiv link rather than a dead button.
 */
export const subscribeVia: 'mailto' | 'beehiiv-link' = 'beehiiv-link';
