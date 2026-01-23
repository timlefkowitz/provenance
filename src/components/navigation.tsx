'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import pathsConfig from '~/config/paths.config';
import { ProfileAccountDropdownContainer } from './personal-account-dropdown-container';
import { NotificationBadge } from './notification-badge';
import { PerspectiveSwitcher } from './perspective-switcher';

export function Navigation() {
  const user = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-wine/20 bg-parchment/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-8">
        <Link 
          href="/" 
          className="text-2xl font-display font-bold tracking-widest uppercase text-wine hover:text-wine/80 transition-colors"
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
                href="/portal" 
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                Portal
              </Link>
              <Link 
                href="/profiles" 
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                Profiles
              </Link>
              <Link 
                href="/registry" 
                className="text-ink hover:text-wine transition-colors font-serif"
              >
                <Trans i18nKey="common:navigation.registry" defaults="Registry" />
              </Link>
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
            <ProfileAccountDropdownContainer />
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
                <ProfileAccountDropdownContainer />
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
                  href="/portal" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Portal
                </Link>
                <Link 
                  href="/profiles" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profiles
                </Link>
                <Link 
                  href="/registry" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Trans i18nKey="common:navigation.registry" defaults="Registry" />
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
                <Link 
                  href="/notifications" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2 border-b border-wine/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Notifications
                </Link>
                <Link 
                  href="/artworks/add" 
                  className="text-ink hover:text-wine transition-colors font-serif py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Trans i18nKey="common:navigation.addArtwork" defaults="Add Artwork" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

