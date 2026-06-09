'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { JwtPayload } from '@supabase/supabase-js';
import { ChevronDown } from 'lucide-react';
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

export function Navigation(props: { initialUser?: JwtPayload | null }) {
  const pathname = usePathname();
  const user = useCurrentUser(props.initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Investor pages have their own dedicated nav; hide the main nav there.
  // Preview mode renders templates full-screen with its own floating bar.
  if (pathname?.startsWith('/investors') || pathname?.startsWith('/profile/site/preview')) {
    return null;
  }

  return (
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
                <DropdownMenuTrigger className={`${desktopNavItemClass} gap-1 font-medium data-[state=open]:text-wine`}>
                  Toolbox
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[200]">
                  <DropdownMenuItem asChild>
                    <Link href="/profile/site" className="cursor-pointer">
                      My website
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/exhibitions" className="cursor-pointer">
                      Exhibitions
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/grants" className="cursor-pointer">
                      Grants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portal/or" className="cursor-pointer">
                      CRM
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/operations" className="cursor-pointer">
                      Operations
                    </Link>
                  </DropdownMenuItem>
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

      {/* Mobile fullscreen menu */}
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
                <span className="w-full text-center text-sm font-display text-wine/70 uppercase tracking-widest py-3">
                  Toolbox
                </span>
                <Link
                  href="/profile/site"
                  className="w-full text-center text-base font-serif text-ink/80 hover:text-wine transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My website
                </Link>
                <Link
                  href="/exhibitions"
                  className="w-full text-center text-base font-serif text-ink/80 hover:text-wine transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Exhibitions
                </Link>
                <Link
                  href="/grants"
                  className="w-full text-center text-base font-serif text-ink/80 hover:text-wine transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Grants
                </Link>
                <Link
                  href="/portal/or"
                  className="w-full text-center text-base font-serif text-ink/80 hover:text-wine transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  CRM
                </Link>
                <Link
                  href="/operations"
                  className="w-full text-center text-base font-serif text-ink/80 hover:text-wine transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Operations
                </Link>
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
    </nav>
  );
}

