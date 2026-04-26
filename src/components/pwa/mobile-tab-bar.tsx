'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, PlusSquare, User, Compass } from 'lucide-react';
import { useCurrentUser } from '~/hooks/use-current-user';
import { usePWA } from './pwa-provider';
import { cn } from '@kit/ui/utils';

interface TabItem {
  href: string;
  icon: typeof Home;
  label: string;
  requiresAuth?: boolean;
  matchPaths?: string[];
}

const tabs: TabItem[] = [
  {
    href: '/',
    icon: Home,
    label: 'Home',
    matchPaths: ['/'],
  },
  {
    href: '/artworks',
    icon: Compass,
    label: 'Explore',
    matchPaths: ['/artworks', '/registry'],
  },
  {
    href: '/artworks/add',
    icon: PlusSquare,
    label: 'Add',
    requiresAuth: true,
    matchPaths: ['/artworks/add'],
  },
  {
    href: '/artworks/my',
    icon: Search,
    label: 'Collection',
    requiresAuth: true,
    matchPaths: ['/artworks/my', '/collection'],
  },
  {
    href: '/portal',
    icon: User,
    label: 'Profile',
    requiresAuth: true,
    matchPaths: ['/portal', '/settings', '/account'],
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const { isStandalone } = usePWA();

  // Only show in standalone mode (PWA) or on mobile
  // Hide on investor pages
  if (pathname?.startsWith('/investors')) {
    return null;
  }

  const isActive = (tab: TabItem) => {
    if (tab.matchPaths) {
      return tab.matchPaths.some((path) => 
        path === '/' ? pathname === '/' : pathname?.startsWith(path)
      );
    }
    return pathname === tab.href;
  };

  const visibleTabs = tabs.filter((tab) => {
    if (tab.requiresAuth && !user.data) {
      return false;
    }
    return true;
  });

  // If not logged in, show simpler tabs
  const guestTabs: TabItem[] = [
    { href: '/', icon: Home, label: 'Home', matchPaths: ['/'] },
    { href: '/artworks', icon: Compass, label: 'Explore', matchPaths: ['/artworks'] },
    { href: '/registry', icon: Search, label: 'Artists', matchPaths: ['/registry'] },
    { href: '/auth/sign-in', icon: User, label: 'Sign In', matchPaths: ['/auth'] },
  ];

  const displayTabs = user.data ? visibleTabs : guestTabs;

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-50 md:hidden',
        'bg-parchment/95 backdrop-blur-lg border-t border-wine/10',
        'pb-safe' // iOS safe area
      )}
    >
      <div className="flex items-center justify-around px-2 h-16">
        {displayTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-16 h-full',
                'transition-colors touch-manipulation',
                active ? 'text-wine' : 'text-ink/60 active:text-wine'
              )}
            >
              <Icon 
                className={cn(
                  'w-6 h-6 transition-transform',
                  active && 'scale-110'
                )} 
                strokeWidth={active ? 2 : 1.5}
              />
              <span className={cn(
                'text-[10px] font-medium',
                active && 'font-semibold'
              )}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
