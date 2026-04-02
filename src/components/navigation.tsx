'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
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
import { PerspectiveSwitcher } from './perspective-switcher';
import { ProfileSwitcher } from './profile-switcher';
import { UsingGalleryLabel } from './using-gallery-label';
import { INVESTOR_NAV_LINKS } from '~/app/investors/_components/investor-nav-links';

export function Navigation() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const signOut = useSignOut();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showInvestorSubnav = pathname?.startsWith('/investors') ?? false;

  return (
    <header className="sticky top-0 z-50 shadow-sm">
    <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-wine/20 bg-parchment/95 backdrop-blur-sm">
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
            className="text-ink hover:text-wine transition-colors font-serif"
          >
            <Trans i18nKey="common:navigation.artworks" defaults="Artworks" />
          </Link>
          {user.data && (
            <>
              <Link
                href="/artworks/my"
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                Collection
              </Link>
              <Link 
                href="/portal" 
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                Portal
              </Link>
              <Link 
                href="/registry" 
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                <Trans i18nKey="common:navigation.registry" defaults="Registry" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-ink hover:text-wine transition-colors font-serif font-medium outline-none data-[state=open]:text-wine">
                  Toolbox
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="font-serif">
                  <DropdownMenuItem asChild>
                    <Link href="/grants" className="cursor-pointer">
                      Grants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/open-calls/browse" className="cursor-pointer">
                      Open Calls
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portal/or" className="cursor-pointer">
                      OR
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/subscription" className="cursor-pointer">
                      Subscription
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Link 
            href="/about" 
            className="text-ink hover:text-wine transition-colors font-serif"
          >
            <Trans i18nKey="common:navigation.about" defaults="About" />
          </Link>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-wine hover:text-wine/80 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
        {user.data ? (
          <>
            <NotificationBadge />
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href="/artworks/add">
                <Trans i18nKey="common:navigation.addArtwork" defaults="Add Artwork" />
              </Link>
            </Button>
            <ProfileAccountDropdownContainer user={user.data} />
          </>
        ) : (
          <>
            <Button 
              asChild 
              variant="ghost" 
              size="sm"
              className="text-ink hover:text-wine hover:bg-wine/10 font-serif"
            >
              <Link href={pathsConfig.auth.signIn}>
                <Trans i18nKey="common:navigation.logIn" defaults="Log In" />
              </Link>
            </Button>
            <Button 
              asChild 
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href={pathsConfig.auth.signUp}>
                <Trans i18nKey="common:navigation.signUp" defaults="Sign Up" />
              </Link>
            </Button>
          </>
        )}
      </div>

        {/* Mobile Auth Buttons (when menu is closed) */}
        {!mobileMenuOpen && (
          <div className="md:hidden flex items-center gap-2">
            {user.data ? (
              <>
                <NotificationBadge />
                <ProfileAccountDropdownContainer user={user.data} />
              </>
            ) : (
              <>
                <Button 
                  asChild 
                  variant="ghost" 
                  size="sm"
                  className="text-ink hover:text-wine hover:bg-wine/10 font-serif text-xs px-2"
                >
                  <Link href={pathsConfig.auth.signIn}>
                    <Trans i18nKey="common:navigation.logIn" defaults="Log In" />
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="sm"
                  className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs px-2"
                >
                  <Link href={pathsConfig.auth.signUp}>
                    <Trans i18nKey="common:navigation.signUp" defaults="Sign Up" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-parchment border-b border-wine/20 shadow-lg md:hidden z-50">
          <div className="flex flex-col px-6 py-4 gap-4">
            {/* Role Switcher */}
            {user.data && (
              <PerspectiveSwitcher compact />
            )}
            {/* When Gallery: show which gallery the user is using */}
            {user.data && (
              <UsingGalleryLabel />
            )}
            {/* Profile Switcher (e.g. switch between multiple galleries) */}
            {user.data && (
              <ProfileSwitcher compact />
            )}
            
            <Link 
              href="/artworks" 
              className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="common:navigation.artworks" defaults="Artworks" />
            </Link>
            {user.data && (
              <>
                <Link 
                  href="/artworks/add" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Add Artwork
                </Link>
                <Link 
                  href="/artworks/my"
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Collection
                </Link>
                <Link 
                  href="/portal" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Portal
                </Link>
                <Link 
                  href="/registry" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Trans i18nKey="common:navigation.registry" defaults="Registry" />
                </Link>
                <span className="block py-2 border-b border-wine/10 text-wine/80 font-medium text-xs uppercase tracking-wider">
                  Toolbox
                </span>
                <Link 
                  href="/grants" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 pl-4 border-b border-wine/10 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Grants
                </Link>
                <Link 
                  href="/open-calls/browse" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 pl-4 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Open Calls
                </Link>
                <Link 
                  href="/portal/or" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 pl-4 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  OR
                </Link>
                <Link 
                  href="/subscription" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 pl-4 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Subscription
                </Link>
              </>
            )}
            <Link 
              href="/about" 
              className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Trans i18nKey="common:navigation.about" defaults="About" />
            </Link>
            {user.data && (
              <>
                <button
                  type="button"
                  className="flex items-center justify-between text-ink hover:text-wine transition-colors font-serif py-2"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut.mutateAsync();
                  }}
                >
                  <Trans i18nKey="auth:signOut" defaults="Sign Out" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
    {showInvestorSubnav && (
      <nav
        className="border-b border-wine/30 bg-parchment/95"
        aria-label="Investor materials"
      >
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-3">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm">
            {INVESTOR_NAV_LINKS.map(({ href, label }) => {
              const isActive =
                href === '/investors'
                  ? pathname === '/investors'
                  : pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={
                      isActive
                        ? 'text-wine font-semibold underline underline-offset-4'
                        : 'text-ink/80 hover:text-wine hover:underline underline-offset-4'
                    }
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    )}
    </header>
  );
}

