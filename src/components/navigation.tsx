'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { JwtPayload } from '@supabase/supabase-js';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  ChevronDown,
  ClipboardList,
  GalleryVerticalEnd,
  Globe,
  Mail,
  Users,
  Wrench,
} from 'lucide-react';
import { useCurrentUser } from '~/hooks/use-current-user';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import pathsConfig from '~/config/paths.config';
import { ProfileAccountDropdownContainer } from './personal-account-dropdown-container';
import { NotificationBadge } from './notification-badge';
import { ProfileSwitcher } from './profile-switcher';
import { UsingGalleryLabel } from './using-gallery-label';

const desktopNavItemClass =
  'inline-flex items-center rounded-md px-2 py-1 -mx-2 -my-1 text-ink hover:text-wine transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment';

type ToolboxItem =
  | { href: string; label: string; description: string; icon: LucideIcon; image?: never }
  | { href: string; label: string; description: string; image: string; icon?: never };

/**
 * Toolbox entries shared between the desktop dropdown and the mobile menu.
 * Each tool gets an icon + short description for the rich dropdown panel.
 * Items with `image` use a photo in the icon slot instead of a Lucide icon.
 */
const TOOLBOX_ITEMS: ToolboxItem[] = [
  {
    href: '/taco',
    label: 'Ask Taco',
    description: 'Your studio AI — chat, images & docs',
    image: '/taco-cat.png',
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

export function Navigation(props: { initialUser?: JwtPayload | null }) {
  const pathname = usePathname();
  const user = useCurrentUser(props.initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Investor pages have their own dedicated nav; hide the main nav there.
  // Preview mode renders templates full-screen with its own floating bar.
  // Docs has its own dark shell with sidebar navigation.
  if (
    pathname?.startsWith('/investors') ||
    pathname?.startsWith('/profile/site/preview') ||
    pathname?.startsWith('/docs')
  ) {
    return null;
  }

  return (
    <>
    <nav className="relative z-[100] flex items-center justify-between gap-3 px-4 sm:px-6 pl-safe pr-safe py-3 sm:py-4 border-b border-wine/20 bg-parchment/95 backdrop-blur-sm sticky top-0 shadow-sm">
      <div className="flex items-center gap-8 min-w-0">
        <Link 
          href="/" 
          className="block max-w-[60vw] truncate text-xl sm:text-2xl font-display font-bold tracking-wide sm:tracking-widest uppercase text-wine hover:text-wine/80 transition-colors"
        >
          Provenance
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link 
            href="/artworks" 
            className={desktopNavItemClass}
          >
            <Trans i18nKey="common:navigation.artworks" defaults="Artworks" />
          </Link>
          <Link 
            href="/registry" 
            className={desktopNavItemClass}
          >
            <Trans i18nKey="common:navigation.registry" defaults="Artists" />
          </Link>
          {user.data && (
            <>
              <Link
                href="/artworks/my"
                className={desktopNavItemClass}
              >
                Collection
              </Link>
              <Link 
                href="/portal" 
                className={desktopNavItemClass}
              >
                Portal
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`${desktopNavItemClass} group gap-1.5 font-medium data-[state=open]:text-wine`}
                >
                  <Wrench className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-rotate-12 group-data-[state=open]:-rotate-[24deg] group-data-[state=open]:scale-110" />
                  Toolbox
                  <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={10}
                  className="toolbox-dropdown z-[200] w-72 p-1.5 rounded-xl border-wine/15 bg-parchment shadow-xl shadow-wine/10"
                >
                  <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-wine/60">
                      Your studio toolbox
                    </span>
                    <span className="flex-1 h-px bg-wine/10" />
                  </div>
                  {TOOLBOX_ITEMS.map((item, i) => (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className="animate-toolbox-item rounded-lg p-0 focus:bg-wine/5"
                      style={{ animationDelay: `${60 + i * 45}ms` }}
                    >
                      <Link
                        href={item.href}
                        className="group/item flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine transition-all duration-300 group-hover/item:bg-wine group-hover/item:text-parchment group-hover/item:scale-105 group-hover/item:shadow-md group-hover/item:shadow-wine/25 overflow-hidden">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.label}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover object-top rounded-lg"
                            />
                          ) : item.icon ? (
                            <item.icon className="h-4 w-4" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink leading-tight">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-ink/50 leading-tight mt-0.5">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Link href="/blog" className={desktopNavItemClass}>
            <Trans i18nKey="marketing:blog" defaults="Blog" />
          </Link>
          <Link 
            href="/about" 
            className={desktopNavItemClass}
          >
            <Trans i18nKey="common:navigation.about" defaults="About" />
          </Link>
          <Link href="/docs" className={desktopNavItemClass}>
            Docs
          </Link>
        </div>
      </div>

      {/*
        Right-side cluster.
        IMPORTANT: NotificationBadge and the user avatar/dropdown remain visible
        at every breakpoint — only the secondary "Add Artwork" CTA and the
        marketing sign-in/up buttons collapse behind the hamburger on mobile.
        This way users on iPhone 16 Pro Max / Pixel 9 Pro can still reach
        notifications and account actions with one tap.
      */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {user.data ? (
          <>
            {/* Notifications — always visible */}
            <NotificationBadge />

            {/* Add Artwork — desktop / tablet only; mobile users use the hamburger menu */}
            <Button
              asChild
              size="sm"
              className="hidden md:inline-flex bg-wine text-parchment hover:bg-wine/90"
            >
              <Link href="/artworks/add">
                <Trans i18nKey="common:navigation.addArtwork" defaults="Add Artwork" />
              </Link>
            </Button>

            {/* User dropdown — always visible */}
            <ProfileAccountDropdownContainer />
          </>
        ) : (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex text-ink hover:text-wine hover:bg-wine/10"
            >
              <Link href={pathsConfig.auth.signIn}>
                <Trans i18nKey="common:navigation.logIn" defaults="Log In" />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden md:inline-flex bg-wine text-parchment hover:bg-wine/90"
            >
              <Link href={pathsConfig.auth.signUp}>
                <Trans i18nKey="common:navigation.signUp" defaults="Sign Up" />
              </Link>
            </Button>
          </>
        )}

        {/* Mobile hamburger — last so it stays at the right edge */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden -mr-1 p-2 text-wine hover:text-wine/80 transition-colors touch-manipulation"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line
              x1="3"
              y1="6"
              x2="21"
              y2="6"
              className={`transition-transform duration-300 origin-center ${
                mobileMenuOpen ? 'translate-y-[6px] rotate-45' : ''
              }`}
            />
            <line
              x1="3"
              y1="12"
              x2="21"
              y2="12"
              className={`transition-all duration-300 origin-center ${
                mobileMenuOpen ? 'opacity-0 scale-x-0' : ''
              }`}
            />
            <line
              x1="3"
              y1="18"
              x2="21"
              y2="18"
              className={`transition-transform duration-300 origin-center ${
                mobileMenuOpen ? '-translate-y-[6px] -rotate-45' : ''
              }`}
            />
          </svg>
        </button>
      </div>

    </nav>

      {/* Mobile fullscreen menu — must live OUTSIDE <nav> so that the nav's
          backdrop-filter does not create a new containing block and break
          position:fixed on iOS/Android. */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[var(--nav-h)] bg-parchment md:hidden z-[90] flex flex-col overflow-y-auto pb-safe">
          {user.data && (
            <div className="shrink-0 px-6 pt-4 flex flex-col items-center gap-2">
              <UsingGalleryLabel />
              <ProfileSwitcher compact />
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center gap-1 px-6 py-8 w-full max-w-sm mx-auto">
            <Link
              href="/artworks"
              className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="common:navigation.artworks" defaults="Artworks" />
            </Link>
            <Link
              href="/registry"
              className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="common:navigation.registry" defaults="Artists" />
            </Link>
            {user.data && (
              <>
                <Link
                  href="/artworks/add"
                  className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Add Artwork
                </Link>
                <Link
                  href="/artworks/my"
                  className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Collection
                </Link>
                <Link
                  href="/portal"
                  className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Portal
                </Link>
                <div className="w-full flex items-center gap-2.5 pt-4 pb-2 px-1">
                  <span className="flex-1 h-px bg-wine/15" />
                  <span className="inline-flex items-center gap-1.5 text-xs font-display text-wine/70 uppercase tracking-widest">
                    <Wrench className="h-3.5 w-3.5" />
                    Toolbox
                  </span>
                  <span className="flex-1 h-px bg-wine/15" />
                </div>
                <div className="w-full grid grid-cols-2 gap-2 pb-2">
                  {TOOLBOX_ITEMS.map((item, i) => {
                    const featured = i === 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`animate-toolbox-item rounded-xl border transition-colors touch-manipulation ${
                          featured
                            ? 'col-span-2 flex items-center gap-3 border-wine/30 bg-wine/5 px-4 py-3 hover:border-wine/50 active:bg-wine/10'
                            : 'flex flex-col items-center gap-1.5 border-wine/15 bg-white/50 px-2 py-3.5 text-center hover:border-wine/40 hover:bg-wine/5 active:bg-wine/10'
                        }`}
                        style={{ animationDelay: `${i * 45}ms` }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine overflow-hidden">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.label}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover object-top rounded-lg"
                            />
                          ) : item.icon ? (
                            <item.icon className="h-4 w-4" />
                          ) : null}
                        </span>
                        {featured ? (
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-serif font-semibold text-ink leading-tight">
                              {item.label}
                            </span>
                            <span className="block text-[11px] font-serif text-ink/50 leading-tight mt-0.5">
                              {item.description}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-serif font-semibold text-ink leading-tight">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
            <Link
              href="/blog"
              className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="marketing:blog" defaults="Blog" />
            </Link>
            <Link
              href="/about"
              className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="common:navigation.about" defaults="About" />
            </Link>
            <Link
              href="/docs"
              className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              Docs
            </Link>
            <Link
              href="/feedback"
              className="w-full text-center text-base font-serif text-ink/70 hover:text-wine transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Feedback
            </Link>
          </div>

          {!user.data && (
            <div className="shrink-0 px-6 pb-8 flex flex-col gap-2 max-w-xs mx-auto w-full">
              <Button
                asChild
                variant="outline"
                className="w-full border-wine/30 text-ink hover:bg-wine/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link href={pathsConfig.auth.signIn}>
                  <Trans i18nKey="common:navigation.logIn" defaults="Log In" />
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-wine text-parchment hover:bg-wine/90"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link href={pathsConfig.auth.signUp}>
                  <Trans i18nKey="common:navigation.signUp" defaults="Sign Up" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

