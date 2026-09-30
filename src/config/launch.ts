/**
 * Launch gates for sections that are not approved for the public launch.
 *
 * Two switches, not one, because DECISIONS.md launches them separately:
 * articles go live once the first one is finished, so the section never opens
 * empty; the monitor is a new kind of data and needs its own decision. Turning
 * either on needs Gavin and Alex to agree, recorded in DECISIONS.md.
 */
export const articlesEnabled = false;
export const monitorEnabled = false;
