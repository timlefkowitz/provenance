'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Home, Layers, Plus, User } from 'lucide-react';
import { useUser } from '@kit/supabase/hooks/use-user';
import { cn } from '@kit/ui/utils';
import pathsConfig from '~/config/paths.config';

/**
 * iPhone-only bottom tab bar.
 *
 * Renders a fixed bottom navigation bar exclusively on iPhone (detected via
 * user-agent and PWA standalone mode). On every other device — desktop,
 * Android, iPad — this component renders nothing, leaving the existing top
 * `Navigation` to handle its job.
 *
 * Designed to feel like a native iOS tab bar: respects safe-area-inset-bottom
 * for the home indicator, uses the parchment/wine palette, and matches the
 * editorial typography of the rest of the journal.
 */

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  /** When true, render as the prominent center action button. */
  prominent?: boolean;
  /** Match this prefix when highlighting the active tab. */
  matchPrefix?: string;
};

function useIsIPhone(): boolean {
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent;
    // iPhone or iPod. We intentionally exclude iPad — iPads should use the
    // desktop layout because they have plenty of horizontal real estate.
    const isiOSPhone = /iPhone|iPod/.test(ua);

    // Also treat installed PWAs (standalone) as iPhone-like, since the user
    // explicitly opted into the app shell.
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS-specific Safari standalone flag
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    setIsIPhone(isiOSPhone || isStandalone);
  }, []);

  return isIPhone;
}

export function IPhoneBottomNav() {
  const isIPhone = useIsIPhone();
  const pathname = usePathname();
  const user = useUser();
  const isSignedIn = Boolean(user.data);

  if (!isIPhone) return null;

  // Hide on auth pages — they should feel like a focused full-screen flow.
  if (pathname?.startsWith('/auth')) return null;

  const tabs: Tab[] = [
    { href: '/', label: 'Home', icon: Home },
    {
      href: '/registry',
      label: 'Registry',
      icon: BookOpen,
      matchPrefix: '/registry',
    },
    {
      href: isSignedIn ? '/artworks/add' : pathsConfig.auth.signUp,
      label: 'Add',
      icon: Plus,
      prominent: true,
    },
    {
      href: '/collections',
      label: 'Collections',
      icon: Layers,
      matchPrefix: '/collections',
    },
    {
      href: isSignedIn ? pathsConfig.app.profileSettings : pathsConfig.auth.signIn,
      label: isSignedIn ? 'Profile' : 'Sign In',
      icon: User,
      matchPrefix: '/settings',
    },
  ];

  return (
    <>
      {/* Spacer so page content can never be obscured by the fixed bar. */}
      <div
        aria-hidden="true"
        className="h-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      />

      <nav
        aria-label="Primary"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'border-t border-wine/20 bg-parchment/95 backdrop-blur-md',
          'shadow-[0_-1px_0_0_rgba(74,47,37,0.06)]',
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
          {tabs.map((tab) => {
            const isActive = tab.matchPrefix
              ? pathname?.startsWith(tab.matchPrefix) ?? false
              : pathname === tab.href;
            const Icon = tab.icon;

            if (tab.prominent) {
              return (
                <li key={tab.label} className="flex items-end">
                  <Link
                    href={tab.href}
                    aria-label={tab.label}
                    className={cn(
                      'flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full',
                      'bg-wine text-parchment shadow-md',
                      'transition-transform active:scale-95',
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                    <span className="sr-only">{tab.label}</span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={tab.label} className="flex flex-1">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5',
                    'transition-colors',
                    isActive ? 'text-wine' : 'text-ink/55 hover:text-ink',
                  )}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      'font-serif text-[10px] tracking-wide uppercase',
                      isActive ? 'font-semibold' : 'font-normal',
                    )}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
