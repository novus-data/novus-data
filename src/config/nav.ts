/**
 * Site navigation. The header, the mobile menu, the footer and the sitemap all
 * read from here, so adding a section to the site is one edit.
 *
 * Order is deliberate: the register and the exposure chart are what the site is
 * for, so they lead. The email briefing is one part of the site rather than the
 * whole of it, and sits after them.
 */

import { articlesEnabled, mancaleEnabled, monitorEnabled } from '@/config/launch';

export interface NavItem {
  href: string;
  label: string;
  /**
   * Words the header adds after the label when there is room (from `lg` up).
   * "Mancalë" alone is a coined word that tells a first-time reader nothing;
   * "Mancalë Index" says what kind of thing it is. At tablet width the seven
   * links already fill the row, so the suffix drops out there.
   */
  suffix?: string;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

/**
 * Shown in the header and the mobile menu.
 *
 * Home leads and is named explicitly. The wordmark also links to `/`, which is
 * the web's oldest convention, but a convention is not an affordance: a reader
 * who is three pages deep should not have to know it. Both routes home now
 * exist, and the labelled one costs a single nav item.
 */
export const primaryNav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/disruptions', label: 'Disruptions' },
  { href: '/exposure', label: 'Exposure' },
  { href: '/briefings', label: 'Briefings' },
  // A whole section, so it belongs where readers look first rather than in
  // the footer (Alex's call, 13 October 2026). Shown only while the section
  // is switched on, so a reader is never sent to a 404.
  ...(articlesEnabled ? [{ href: '/articles', label: 'Articles' }] : []),
  // The Mancalë Index: the site's one calculated indicator. In the header
  // because it is a section readers come back to weekly; move it to the
  // footer list if seven header items is one too many (Alex's call).
  ...(mancaleEnabled ? [{ href: '/mancale', label: 'Mancalë', suffix: 'Index' }] : []),
  { href: '/about', label: 'About' },
];

/**
 * Shown in the footer, in labelled groups. Fourteen links in one grid read as a
 * sitemap dump; three headed lists tell a reader where to look. Home is not in
 * a group: the wordmark above them is the way home.
 */
export const footerGroups: NavGroup[] = [
  {
    heading: 'The record',
    items: [
      { href: '/disruptions', label: 'Disruptions' },
      { href: '/exposure', label: 'Exposure chart' },
      // Not in the header: the entity index is reached from the chart, which is
      // where a reader is when the question "what about this name" occurs to
      // them. A sixth header item to reach a seventh page would cost more than
      // it earns.
      { href: '/entities', label: 'Companies' },
      ...(mancaleEnabled ? [{ href: '/mancale', label: 'Mancalë Index' }] : []),
      ...(monitorEnabled ? [{ href: '/monitor', label: 'Monitor' }] : []),
    ],
  },
  {
    heading: 'Writing',
    items: [
      { href: '/briefings', label: 'Briefings' },
      ...(articlesEnabled ? [{ href: '/articles', label: 'Articles' }] : []),
      { href: '/subscribe', label: 'Subscribe' },
    ],
  },
  {
    heading: 'About',
    items: [
      { href: '/about', label: 'About' },
      { href: '/coverage', label: 'Coverage' },
      { href: '/alerts', label: 'Alerts' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

/**
 * Every internal page the footer reaches, flat. The sitemap reads this, so it
 * is built from the groups rather than kept beside them: a page added to a
 * group is in the sitemap with no second edit.
 */
export const footerNav: NavItem[] = [
  { href: '/', label: 'Home' },
  ...footerGroups.flatMap((group) => group.items),
];
