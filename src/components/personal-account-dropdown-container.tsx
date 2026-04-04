'use client';

import { useMemo, useState, useEffect, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JwtPayload } from '@supabase/supabase-js';
import {
  Check,
  ChevronDown,
  Computer,
  Home,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '~/hooks/use-current-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { If } from '@kit/ui/if';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import type { AppDatabase } from '~/lib/supabase-app-database';
import { AdminMenuItem } from './admin-menu-item';
import { getPerspective } from './perspective-switcher';
import { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { languages, I18N_COOKIE_NAME } from '~/lib/i18n/i18n.settings';

import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const PERSPECTIVE_KEY = 'user_perspective';
const SELECTED_PROFILE_KEY = 'selected_profile_id';

const paths = {
  home: pathsConfig.app.home,
  profile: pathsConfig.app.profile,
  profileSettings: pathsConfig.app.profileSettings,
};

const features = {
  enableThemeToggle: featuresFlagConfig.enableThemeToggle,
};

const MODES = ['light', 'dark', 'system'] as const;

/** Matches DropdownMenuItem surface so the popover menu feels the same */
const rowClass =
  'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center rounded-xs px-2 py-1.5 text-sm outline-none transition-colors select-none hover:bg-accent hover:text-accent-foreground';

const sepClass = 'bg-muted -mx-1 my-1 h-px';

function setCookieTheme(theme: string) {
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  switch (theme) {
    case 'light':
      return <Sun className="h-4 w-4" />;
    case 'dark':
      return <Moon className="h-4 w-4" />;
    case 'system':
      return <Computer className="h-4 w-4" />;
    default:
      return <Sun className="h-4 w-4" />;
  }
}

function capitalize(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function ProfileAccountDropdownContainer(props: {
  user?: JwtPayload;
  showProfileName?: boolean;

  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
}) {
  const signOut = useSignOut();
  const user = useCurrentUser(props.user);
  const userData = user.data;
  const client = useSupabase<AppDatabase>();
  const router = useRouter();
  const { i18n } = useTranslation();
  const { setTheme, theme, resolvedTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const userId =
    userData?.sub ?? (userData as { id?: string } | undefined)?.id ?? '';

  const [accountData, setAccountData] = useState<{
    name: string | null;
    picture_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    console.log('[ProfileDropdown] Fetching account data');
    client
      .from('accounts')
      .select('name, picture_url')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileDropdown] Error fetching account data', error);
          return;
        }
        if (data) setAccountData(data);
      });
  }, [userId, client]);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!userId) return;
    console.log('[ProfileDropdown] Fetching user profiles');
    client
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileDropdown] Error fetching profiles', error);
          return;
        }
        setProfiles((data || []) as UserProfile[]);
      });
  }, [userId, client]);

  const [currentPerspective, setCurrentPerspective] = useState<UserRole>(
    USER_ROLES.ARTIST,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    startTransition(() => {
      setCurrentPerspective(getPerspective());
    });
  }, []);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PERSPECTIVE_KEY, role);
        localStorage.removeItem(SELECTED_PROFILE_KEY);
      }
      setCurrentPerspective(role);
      setOpen(false);
      setProfileOpen(false);
      router.refresh();
    },
    [router],
  );

  const profilesForCurrentRole = useMemo(
    () => profiles.filter((p) => p.role === currentPerspective),
    [profiles, currentPerspective],
  );

  const setSelectedProfileAndNavigate = useCallback((profileId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SELECTED_PROFILE_KEY, profileId);
    }
  }, []);

  const signedInAsLabel = useMemo(() => {
    const email = userData?.email ?? undefined;
    const phone = userData?.phone ?? undefined;
    return email ?? phone;
  }, [userData]);

  const languageNames = useMemo(() => {
    return new Intl.DisplayNames([i18n.language], { type: 'language' });
  }, [i18n.language]);

  const languageChanged = useCallback(
    async (locale: string) => {
      if (locale === i18n.language) {
        close();
        return;
      }
      await i18n.changeLanguage(locale);
      const cookieValue = `${I18N_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = cookieValue;
      if (document.documentElement) {
        document.documentElement.lang = locale;
      }
      window.location.reload();
    },
    [i18n, close],
  );

  const getLanguageLabel = (locale: string) => {
    const name = languageNames.of(locale) || locale;
    return capitalize(name);
  };

  if (!userData) {
    return null;
  }

  const displayName =
    accountData?.name ?? props.account?.name ?? userData?.email ?? '';

  const profilePictureUrl = (() => {
    if (currentPerspective === USER_ROLES.GALLERY) {
      const selectedId =
        typeof window !== 'undefined'
          ? localStorage.getItem(SELECTED_PROFILE_KEY)
          : null;
      const galleryProfile =
        profilesForCurrentRole.find((p) => p.id === selectedId) ??
        profilesForCurrentRole[0];
      if (galleryProfile?.picture_url) return galleryProfile.picture_url;
    }
    return (
      accountData?.picture_url ??
      props.account?.picture_url ??
      (userData.user_metadata as { avatar_url?: string } | undefined)
        ?.avatar_url ??
      null
    );
  })();

  return (
    <div className="relative z-[110] shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open your profile menu"
            aria-expanded={open}
            className={cn(
              'touch-manipulation flex cursor-pointer items-center rounded-md border-0 bg-transparent p-0 shadow-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
              'data-[state=open]:bg-secondary/50',
              {
                'active:bg-secondary/50 items-center gap-x-4 p-2 transition-colors hover:bg-secondary':
                  props.showProfileName,
              },
            )}
          >
            <ProfileAvatar
              className="rounded-md"
              fallbackClassName="rounded-md border"
              displayName={displayName ?? userData?.email ?? ''}
              pictureUrl={profilePictureUrl}
            />

            <If condition={props.showProfileName ?? false}>
              <div className="fade-in animate-in flex w-full flex-col truncate text-left">
                <span className="truncate text-sm">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {signedInAsLabel}
                </span>
              </div>

              <ChevronDown className="text-muted-foreground mr-1 h-8" />
            </If>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="z-[300] min-w-[14rem] max-w-[calc(100vw-1.5rem)] p-1 font-serif"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn(rowClass, '!h-auto min-h-10 cursor-default rounded-none py-2')}>
            <div className="flex flex-col justify-start truncate text-left text-xs">
              <div className="text-muted-foreground">
                <Trans i18nKey="common:signedInAs" />
              </div>
              <span className="block truncate font-medium text-ink">
                {signedInAsLabel}
              </span>
            </div>
          </div>

          <div className={sepClass} />

          <Link
            href={paths.home}
            className={cn(rowClass, 'flex items-center space-x-2')}
            onClick={close}
          >
            <Home className="h-5" />
            <span>
              <Trans i18nKey="common:routes.home" />
            </span>
          </Link>

          <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
            <CollapsibleTrigger
              className={cn(rowClass, 'flex w-full items-center justify-between gap-2')}
            >
              <span className="flex items-center space-x-2">
                <User className="h-5" />
                <span>Profile</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-xs font-normal text-muted-foreground">
                  {getRoleLabel(currentPerspective)}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    profileOpen && 'rotate-180',
                  )}
                />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pb-1 pl-1 pt-0">
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Viewing as: {getRoleLabel(currentPerspective)}
              </p>
              {(
                [
                  USER_ROLES.ARTIST,
                  USER_ROLES.COLLECTOR,
                  USER_ROLES.GALLERY,
                ] as const
              ).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={cn(
                    rowClass,
                    'flex items-center justify-between',
                    currentPerspective === role && 'bg-muted',
                  )}
                  onClick={() => switchRole(role)}
                >
                  <span>{getRoleLabel(role)}</span>
                  {currentPerspective === role ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </button>
              ))}
              <div className={sepClass} />
              <Link
                href={paths.profile}
                className={cn(rowClass, 'flex items-center space-x-2')}
                onClick={close}
              >
                <User className="h-4" />
                <span>My Profile</span>
              </Link>
              {profilesForCurrentRole.length > 0
                ? profilesForCurrentRole.map((profile) => (
                    <div key={profile.id} className="space-y-0.5">
                      <Link
                        href={
                          currentPerspective === USER_ROLES.GALLERY
                            ? `/artists/${userId}?role=gallery&profileId=${profile.id}`
                            : `/artists/${userId}?role=${currentPerspective}`
                        }
                        className={cn(rowClass, 'flex items-center space-x-2')}
                        onClick={() => {
                          setSelectedProfileAndNavigate(profile.id);
                          close();
                        }}
                      >
                        <User className="h-4" />
                        <span className="truncate">{profile.name}</span>
                      </Link>
                      {(profile.role === USER_ROLES.GALLERY ||
                        profile.role === USER_ROLES.ARTIST) && (
                        <Link
                          href={`/profiles/${profile.id}/edit`}
                          className={cn(
                            rowClass,
                            'flex items-center space-x-2 pl-6 text-xs text-muted-foreground',
                          )}
                          onClick={close}
                        >
                          <Settings className="h-3.5 w-3.5 shrink-0" />
                          <span>Edit settings &amp; Find articles</span>
                        </Link>
                      )}
                    </div>
                  ))
                : null}
            </CollapsibleContent>
          </Collapsible>

          <div className={sepClass} />

          <AdminMenuItem onNavigate={close} />

          <If condition={features.enableThemeToggle}>
            <>
              <div className={sepClass} />
              <Collapsible open={themeOpen} onOpenChange={setThemeOpen}>
                <CollapsibleTrigger
                  className={cn(
                    rowClass,
                    'flex w-full items-center justify-between gap-2',
                  )}
                >
                  <span className="flex items-center space-x-2">
                    <ThemeIcon theme={resolvedTheme} />
                    <span>
                      <Trans i18nKey="common:theme" />
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      themeOpen && 'rotate-180',
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pb-1 pl-1">
                  {MODES.map((mode) => {
                    const isSelected = theme === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          rowClass,
                          'flex items-center space-x-2',
                          isSelected && 'bg-muted',
                        )}
                        onClick={() => {
                          setTheme(mode);
                          setCookieTheme(mode);
                        }}
                      >
                        <ThemeIcon theme={mode} />
                        <span>
                          <Trans i18nKey={`common:${mode}Theme`} />
                        </span>
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </>
          </If>

          <div className={sepClass} />

          <Collapsible open={languageOpen} onOpenChange={setLanguageOpen}>
            <CollapsibleTrigger
              className={cn(
                rowClass,
                'flex w-full items-center justify-between gap-2',
              )}
            >
              <span className="text-sm font-medium">
                <Trans i18nKey="common:language" defaults="Language" />
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  languageOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pb-1 pl-1">
              {languages.map((locale) => {
                const isSelected = locale === i18n.language;
                return (
                  <button
                    key={locale}
                    type="button"
                    className={cn(
                      rowClass,
                      'flex w-full items-center justify-between',
                      isSelected && 'bg-muted',
                    )}
                    onClick={() => void languageChanged(locale)}
                  >
                    <span>{getLanguageLabel(locale)}</span>
                    {isSelected ? <span className="text-xs">✓</span> : null}
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          <div className={sepClass} />

          <button
            type="button"
            className={cn(rowClass, 'flex items-center space-x-2 text-left')}
            onClick={() => {
              close();
              router.push(paths.profileSettings);
            }}
          >
            <Settings className="h-5" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className={cn(rowClass, 'flex w-full items-center space-x-2 text-left')}
            onClick={() => {
              close();
              void signOut.mutateAsync();
            }}
          >
            <LogOut className="h-5" />
            <span>
              <Trans i18nKey="auth:signOut" />
            </span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
