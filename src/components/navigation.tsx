'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { JwtPayload } from '@supabase/supabase-js';
import { ChevronDown, Wrench } from 'lucide-react';
import type { ToolboxItem, InfoItem } from '~/config/app-nav-items';
import { TOOLBOX_ITEMS, INFO_ITEMS } from '~/config/app-nav-items';
import { cn } from '@kit/ui/utils';
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

// Shared base for desktop nav links and dropdown triggers.
// Uses an ::after underline that scales in on hover / stays full when active.
const BASE_NAV =
  'relative inline-flex items-center px-1 py-0.5 text-sm font-bold uppercase tracking-[0.08em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment font-nav ' +
  "after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:rounded-full after:bg-wine after:transition-all after:duration-300";

function navLinkClass(path: string, pathname: string | null) {
  const isActive =
    path === '/'
      ? pathname === '/'
      : pathname === path || Boolean(pathname?.startsWith(path + '/'));
  return cn(
    BASE_NAV,
    isActive
      ? 'text-wine after:w-full'
      : 'text-ink hover:text-wine after:w-0 hover:after:w-full',
  );
}

const dropdownTriggerClass = cn(
  BASE_NAV,
  'gap-1.5 text-ink hover:text-wine after:w-0 hover:after:w-full',
  'data-[state=open]:text-wine data-[state=open]:after:w-full',
  'group cursor-pointer select-none',
);




export function Navigation(props: { initialUser?: JwtPayload | null }) {
  const pathname = usePathname();
  const user = useCurrentUser(props.initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Detect Capacitor native environment for safe-area / UI adjustments.
    import('~/lib/capacitor/is-native').then(({ isNativePlatform }) => {
      setIsNative(isNativePlatform());
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSelectedProfileId(localStorage.getItem('selected_profile_id'));

    const handleProfileSelected = (e: Event) => {
      setSelectedProfileId((e as CustomEvent<string>).detail);
    };
    window.addEventListener('user_profile_selected', handleProfileSelected);
    return () => window.removeEventListener('user_profile_selected', handleProfileSelected);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []); 

  // Investor pages have their own nav; preview and docs have their own shells.
  if (
    pathname?.startsWith('/investors') ||
    pathname?.startsWith('/profile/site/preview') ||
    pathname?.startsWith('/docs')
  ) {
    return null;
  }

  return (
    <>
      <nav
        className={cn(
          'relative z-[100] flex items-center justify-between py-3 sm:py-4 border-b bg-parchment/95 backdrop-blur-sm sticky top-0 transition-[border-color,box-shadow] duration-300',
          // Safe-area + inset so the wordmark and hamburger never hug the iPhone edge.
          'pl-[calc(env(safe-area-inset-left,0px)+1.5rem)] pr-[calc(env(safe-area-inset-right,0px)+1.5rem)]',
          scrolled ? 'border-wine/35 shadow-md shadow-wine/5' : 'border-wine/20 shadow-sm',
          isNative && 'pt-safe',
        )}
      >
        {/* Logo — left-pinned flex child */}
        <Link
          href="/"
          className="block shrink-0 max-w-[40vw] truncate text-xl sm:text-2xl font-display font-bold tracking-wide sm:tracking-widest uppercase text-wine hover:text-wine/80 transition-colors"
        >
          Provenance
        </Link>

        {/*
          Desktop nav — absolutely centered so it is always at 50% of the bar
          regardless of how wide the logo or actions cluster are at any breakpoint.
        */}
        <div className={cn('hidden md:flex items-center gap-5 absolute left-1/2 -translate-x-1/2 pointer-events-auto', isNative && 'md:hidden')}>
          <Link href="/artworks" className={navLinkClass('/artworks', pathname)}>
            <Trans i18nKey="common:navigation.artworks" defaults="Artworks" />
          </Link>
          {/* Collectibles hidden for now */}
          <Link href="/registry" className={navLinkClass('/registry', pathname)}>
            <Trans i18nKey="common:navigation.registry" defaults="Artists" />
          </Link>

          {user.data && (
            <>
              <Link href="/artworks/my" className={navLinkClass('/artworks/my', pathname)}>
                Collection
              </Link>
              <Link href="/portal" className={navLinkClass('/portal', pathname)}>
                Portal
              </Link>

              {/* Toolbox dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={dropdownTriggerClass}>
                  <Wrench className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-rotate-12 group-data-[state=open]:-rotate-[24deg] group-data-[state=open]:scale-110" />
                  Toolbox
                  <ChevronDown className="h-3 w-3 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
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
                  {TOOLBOX_ITEMS.map((item, i) => {
                    const href =
                      item.href === '/profile/site' && selectedProfileId
                        ? `/profile/site?profileId=${selectedProfileId}`
                        : item.href;
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        asChild
                        className="animate-toolbox-item rounded-lg p-0 focus:bg-wine/5"
                        style={{ animationDelay: `${60 + i * 45}ms` }}
                      >
                        <Link
                          href={href}
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
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Info dropdown — Blog, About, Docs — always visible */}
          <DropdownMenu>
            <DropdownMenuTrigger className={dropdownTriggerClass}>
              Info
              <ChevronDown className="h-3 w-3 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={10}
              className="toolbox-dropdown z-[200] w-52 p-1.5 rounded-xl border-wine/15 bg-parchment shadow-xl shadow-wine/10"
            >
              <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-wine/60">
                  Explore
                </span>
                <span className="flex-1 h-px bg-wine/10" />
              </div>
              {INFO_ITEMS.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  asChild
                  className="animate-toolbox-item rounded-lg p-0 focus:bg-wine/5"
                >
                  <Link
                    href={item.href}
                    className="group/item flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine transition-all duration-300 group-hover/item:bg-wine group-hover/item:text-parchment group-hover/item:scale-105">
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {item.i18nKey ? (
                        <Trans i18nKey={item.i18nKey} defaults={item.defaults} />
                      ) : (
                        item.label
                      )}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/*
          Right-side cluster.
          NotificationBadge and account avatar stay visible at every breakpoint.
          "Add Artwork" CTA and marketing auth buttons collapse on mobile.
        */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {user.data ? (
            <>
              {/* Notifications — always visible */}
              <NotificationBadge />

              {/* Add Artwork — desktop/tablet only; hidden in native (Add tab replaces it) */}
              {!isNative && (
              <Button
                asChild
                size="sm"
                className="hidden md:inline-flex bg-wine text-parchment hover:bg-wine/90"
              >
                <Link href="/artworks/add">
                  <Trans i18nKey="common:navigation.addArtwork" defaults="Add Artwork" />
                </Link>
              </Button>
              )}

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

          {/* Mobile hamburger — hidden in native when signed in (More sheet replaces it) */}
          {!(isNative && user.data) && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-wine hover:text-wine/80 transition-colors touch-manipulation"
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
          )}
        </div>
      </nav>

      {/* Mobile fullscreen menu — lives outside <nav> so nav's backdrop-filter
          does not create a new containing block breaking position:fixed on iOS. */}
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
            {/* Collectibles hidden for now */}
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

                {/* Toolbox section */}
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
                    const href =
                      item.href === '/profile/site' && selectedProfileId
                        ? `/profile/site?profileId=${selectedProfileId}`
                        : item.href;
                    return (
                      <Link
                        key={item.href}
                        href={href}
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

            {/* Info section — Blog, About, Docs */}
            <div className="w-full flex items-center gap-2.5 pt-4 pb-2 px-1">
              <span className="flex-1 h-px bg-wine/15" />
              <span className="text-xs font-display text-wine/70 uppercase tracking-widest">
                Info
              </span>
              <span className="flex-1 h-px bg-wine/15" />
            </div>
            {INFO_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-full text-center text-lg font-display text-ink hover:text-wine transition-colors py-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.i18nKey ? (
                  <Trans i18nKey={item.i18nKey} defaults={item.defaults} />
                ) : (
                  item.label
                )}
              </Link>
            ))}

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
