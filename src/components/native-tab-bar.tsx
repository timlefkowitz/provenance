'use client';

import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Images,
  Library,
  Plus,
  LayoutDashboard,
  MoreHorizontal,
  X,
  Users,
  Settings,
  User,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@kit/ui/utils';
import { useCurrentUser } from '~/hooks/use-current-user';
import { TOOLBOX_ITEMS, INFO_ITEMS } from '~/config/app-nav-items';
import { isAppMode } from '~/lib/app-mode';

// Suppressed routes — same set used by navigation.tsx
const SUPPRESSED_PREFIXES = ['/investors', '/profile/site/preview', '/docs'];

function isSuppressed(pathname: string | null) {
  if (!pathname) return false;
  return SUPPRESSED_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Active-state predicates for each tab.
 * Each function receives the current pathname and returns true when that tab
 * should be highlighted.  Intentionally narrow so sibling routes don't "bleed"
 * onto the wrong tab (e.g. /artworks/my should NOT light up the Artworks tab).
 */
function isArtworksActive(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === '/artworks') return true;
  // Individual artwork pages: /artworks/{uuid} but NOT /artworks/my or /artworks/add
  if (pathname.startsWith('/artworks/') && !pathname.startsWith('/artworks/my') && !pathname.startsWith('/artworks/add')) return true;
  return false;
}
function isCollectionActive(pathname: string | null) {
  return pathname === '/artworks/my' || Boolean(pathname?.startsWith('/artworks/my/'));
}
function isAddActive(pathname: string | null) {
  return pathname === '/artworks/add' || Boolean(pathname?.startsWith('/artworks/add/'));
}
function isPortalActive(pathname: string | null) {
  return pathname === '/portal' || Boolean(pathname?.startsWith('/portal/'));
}

export function NativeTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isNative, setIsNative] = useState(false);
  const { data: user } = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setIsNative(isAppMode());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSelectedProfileId(localStorage.getItem('selected_profile_id'));
    const handler = (e: Event) => setSelectedProfileId((e as CustomEvent<string>).detail);
    window.addEventListener('user_profile_selected', handler);
    return () => window.removeEventListener('user_profile_selected', handler);
  }, []);

  // Close the More sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (!isNative) return null;
  if (!user) return null;
  if (isSuppressed(pathname)) return null;

  const tabs = [
    {
      id: 'artworks',
      label: 'Artworks',
      href: '/artworks',
      icon: Images,
      active: isArtworksActive(pathname),
    },
    {
      id: 'collection',
      label: 'Collection',
      href: '/artworks/my',
      icon: Library,
      active: isCollectionActive(pathname),
    },
    {
      id: 'add',
      label: 'Add',
      href: '/artworks/add',
      icon: Plus,
      active: isAddActive(pathname),
      isCta: true,
    },
    {
      id: 'portal',
      label: 'Portal',
      href: '/portal',
      icon: LayoutDashboard,
      active: isPortalActive(pathname),
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      active: moreOpen,
    },
  ] as const;

  const websiteEditorHref = selectedProfileId
    ? `/profile/site?profileId=${selectedProfileId}`
    : '/profile/site';

  return (
    <>
      {/* Tab bar */}
      <nav
        data-native-bottom
        className="fixed bottom-0 inset-x-0 z-[95] flex items-stretch bg-parchment/95 backdrop-blur-sm border-t border-wine/20 pb-safe"
        style={{ height: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))' }}
      >
        {tabs.map((tab) => {
          if (tab.id === 'add') {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex flex-1 flex-col items-center justify-center min-h-[44px] gap-0.5"
                aria-label="Add artwork"
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                    tab.active ? 'bg-wine' : 'bg-wine/85',
                  )}
                >
                  <Plus className="h-5 w-5 text-parchment stroke-[2.5]" />
                </span>
              </Link>
            );
          }

          if (tab.id === 'more') {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className="flex flex-1 flex-col items-center justify-center min-h-[44px] gap-0.5 select-none"
                aria-label="More options"
              >
                <tab.icon
                  className={cn(
                    'h-6 w-6 transition-colors',
                    tab.active ? 'text-wine' : 'text-ink/60',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium transition-colors',
                    tab.active ? 'text-wine' : 'text-ink/60',
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center min-h-[44px] gap-0.5"
            >
              <tab.icon
                className={cn(
                  'h-6 w-6 transition-colors',
                  tab.active ? 'text-wine' : 'text-ink/60',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  tab.active ? 'text-wine' : 'text-ink/60',
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* More sheet — backdrop + panel */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[96] bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-[97] flex flex-col rounded-t-2xl bg-parchment shadow-xl max-h-[80dvh]"
            style={{ paddingBottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Handle + close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-ink/20" />
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="absolute right-4 top-4 p-1 rounded-full text-ink/50 hover:text-ink"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-4 pb-4 space-y-5">
              {/* Explore section */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 px-1 mb-2">
                  Explore
                </p>
                <MoreLink
                  href="/registry"
                  icon={<Users className="h-5 w-5" />}
                  label="Artists"
                  onNavigate={() => setMoreOpen(false)}
                />
              </section>

              {/* Toolbox section */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 px-1 mb-2">
                  Toolbox
                </p>
                <div className="space-y-1">
                  {TOOLBOX_ITEMS.map((item) => {
                    const href =
                      item.href === '/profile/site' ? websiteEditorHref : item.href;
                    return (
                      <MoreLink
                        key={item.href}
                        href={href}
                        icon={
                          item.image ? (
                            <Image
                              src={item.image}
                              alt={item.label}
                              width={20}
                              height={20}
                              className="h-5 w-5 object-cover rounded"
                            />
                          ) : item.icon ? (
                            <item.icon className="h-5 w-5" />
                          ) : null
                        }
                        label={item.label}
                        description={item.description}
                        onNavigate={() => setMoreOpen(false)}
                      />
                    );
                  })}
                </div>
              </section>

              {/* Info section */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 px-1 mb-2">
                  Info
                </p>
                <div className="space-y-1">
                  {INFO_ITEMS.map((item) => (
                    <MoreLink
                      key={item.href}
                      href={item.href}
                      icon={<item.icon className="h-5 w-5" />}
                      label={item.label}
                      onNavigate={() => setMoreOpen(false)}
                    />
                  ))}
                </div>
              </section>

              {/* Account section */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 px-1 mb-2">
                  Account
                </p>
                <div className="space-y-1">
                  <MoreLink
                    href="/profile"
                    icon={<User className="h-5 w-5" />}
                    label="Profile"
                    onNavigate={() => setMoreOpen(false)}
                  />
                  <MoreLink
                    href="/notifications"
                    icon={<Bell className="h-5 w-5" />}
                    label="Notifications"
                    onNavigate={() => setMoreOpen(false)}
                  />
                  <MoreLink
                    href="/settings"
                    icon={<Settings className="h-5 w-5" />}
                    label="Settings"
                    onNavigate={() => setMoreOpen(false)}
                  />
                  <MoreLink
                    href="/feedback"
                    icon={<MessageSquare className="h-5 w-5" />}
                    label="Feedback"
                    onNavigate={() => setMoreOpen(false)}
                  />
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Reusable row inside the More sheet ────────────────────────────────────────

function MoreLink({
  href,
  icon,
  label,
  description,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-wine/5 active:bg-wine/10 transition-colors"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-wine/8 text-wine shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink leading-tight">{label}</span>
        {description && (
          <span className="block text-[11px] text-ink/50 leading-tight mt-0.5">{description}</span>
        )}
      </span>
    </Link>
  );
}
