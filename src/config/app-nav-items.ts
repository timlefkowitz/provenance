/**
 * Shared navigation item definitions used by both the desktop/mobile navigation
 * dropdown menus and the native app's "More" bottom sheet.
 *
 * Keeping these in one place ensures the two surfaces never drift apart.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Building2,
  ClipboardList,
  FileText,
  GalleryVerticalEnd,
  Globe,
  Mail,
  Newspaper,
  Target,
  Users,
} from 'lucide-react';

export type ToolboxItem =
  | { href: string; label: string; description: string; icon: LucideIcon; image?: never }
  | { href: string; label: string; description: string; image: string; icon?: never };

export type InfoItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  i18nKey?: string;
  defaults?: string;
};

/**
 * Toolbox entries — the 8 power-user tools in the Toolbox dropdown and More sheet.
 *
 * Note: the Website Editor href gets a `?profileId=` query string appended at
 * render time when the user has a selected profile (see navigation.tsx / native-tab-bar.tsx).
 */
export const TOOLBOX_ITEMS: ToolboxItem[] = [
  {
    href: '/taco',
    label: 'Ask Taco',
    description: 'Your studio AI — chat, images & docs',
    image: '/taco-cat.png',
  },
  {
    href: '/goals',
    label: 'Goals',
    description: 'Track your practice streaks & check in',
    icon: Target,
  },
  {
    href: '/profile/site',
    label: 'Website Editor',
    description: 'Design, edit & publish your site',
    icon: Globe,
  },
  {
    href: '/exhibitions',
    label: 'Exhibitions',
    description: 'Plan and showcase your shows',
    icon: GalleryVerticalEnd,
  },
  {
    href: '/grants',
    label: 'Grants',
    description: 'Find funding & write applications',
    icon: Award,
  },
  {
    href: '/portal/or',
    label: 'CRM',
    description: 'Contacts, collectors & outreach',
    icon: Users,
  },
  {
    href: '/mailing-list',
    label: 'Mailing List',
    description: 'Contacts & email outreach',
    icon: Mail,
  },
  {
    href: '/operations',
    label: 'Operations',
    description: 'Logistics, inventory & tasks',
    icon: ClipboardList,
  },
];

/**
 * Info / marketing links — always visible (no auth gate).
 */
export const INFO_ITEMS: InfoItem[] = [
  { href: '/blog', label: 'Blog', icon: Newspaper, i18nKey: 'marketing:blog', defaults: 'Blog' },
  {
    href: '/about',
    label: 'About',
    icon: Building2,
    i18nKey: 'common:navigation.about',
    defaults: 'About',
  },
  { href: '/docs', label: 'Docs', icon: FileText },
];
