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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';
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

/** Matches menu row surface (also used inside submenus for non-item rows) */
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

  const close = useCallback(() => setOpen(false), []);

  const onMenuOpenChange = useCallback((next: boolean) => {
    if (next) {
      console.log('[ProfileDropdown] menu opened');
    }
    setOpen(next);
  }, []);

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

  const showName = props.showProfileName ?? false;

  return (
    <div className="relative z-[110] shrink-0">
      <DropdownMenu open={open} onOpenChange={onMenuOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open your profile menu"
            aria-expanded={open}
            className={cn(
              'touch-manipulation flex cursor-pointer items-center rounded-md border-0 bg-transparent p-0 shadow-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
              'data-[state=open]:bg-secondary/50',
              !showName && 'min-h-11 min-w-11 justify-center sm:min-h-[44px] sm:min-w-[44px]',
              {
                'active:bg-secondary/50 items-center gap-x-4 p-2 transition-colors hover:bg-secondary':
                  showName,
              },
            )}
          >
            <ProfileAvatar
              className="rounded-md"
              fallbackClassName="rounded-md border"
              displayName={displayName ?? userData?.email ?? ''}
              pictureUrl={profilePictureUrl}
            />

            <If condition={showName}>
              <div className="fade-in animate-in flex w-full flex-col truncate text-left">
                <span className="truncate text-sm">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {signedInAsLabel}
                </span>
              </div>

              <ChevronDown className="text-muted-foreground mr-1 h-8" />
            </If>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="z-[300] min-w-[14rem] max-w-[calc(100vw-1.5rem)] p-1 font-serif"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel
            className={cn(rowClass, '!h-auto min-h-10 cursor-default rounded-none py-2 font-normal')}
          >
            <div className="flex flex-col justify-start truncate text-left text-xs">
              <div className="text-muted-foreground">
                <Trans i18nKey="common:signedInAs" />
              </div>
              <span className="block truncate font-medium text-ink">
                {signedInAsLabel}
              </span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className={sepClass} />

          <DropdownMenuItem asChild>
            <Link
              href={paths.home}
              className={cn(rowClass, 'flex cursor-pointer items-center space-x-2')}
              onClick={close}
            >
              <Home className="h-5" />
              <span>
                <Trans i18nKey="common:routes.home" />
              </span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(rowClass, 'cursor-default justify-between gap-2 font-serif')}
            >
              <span className="flex items-center space-x-2">
                <User className="h-5" />
                <span>Profile</span>
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {getRoleLabel(currentPerspective)}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="z-[320] max-h-[min(70vh,24rem)] min-w-[12rem] overflow-y-auto p-1 font-serif"
              sideOffset={6}
              collisionPadding={16}
            >
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Viewing as: {getRoleLabel(currentPerspective)}
              </p>
              {(
                [
                  USER_ROLES.ARTIST,
                  USER_ROLES.COLLECTOR,
                  USER_ROLES.GALLERY,
                ] as const
              ).map((role) => (
                <DropdownMenuItem
                  key={role}
                  className={cn(
                    rowClass,
                    'cursor-pointer justify-between font-serif',
                    currentPerspective === role && 'bg-muted',
                  )}
                  onSelect={(e) => {
                    e.preventDefault();
                    switchRole(role);
                  }}
                >
                  <span>{getRoleLabel(role)}</span>
                  {currentPerspective === role ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className={sepClass} />
              <DropdownMenuItem asChild>
                <Link
                  href={paths.profile}
                  className={cn(rowClass, 'flex cursor-pointer items-center space-x-2 font-serif')}
                  onClick={close}
                >
                  <User className="h-4" />
                  <span>My Profile</span>
                </Link>
              </DropdownMenuItem>
              {profilesForCurrentRole.length > 0
                ? profilesForCurrentRole.map((profile) => (
                    <div key={profile.id} className="space-y-0.5">
                      <DropdownMenuItem asChild>
                        <Link
                          href={
                            currentPerspective === USER_ROLES.GALLERY
                              ? `/artists/${userId}?role=gallery&profileId=${profile.id}`
                              : `/artists/${userId}?role=${currentPerspective}`
                          }
                          className={cn(
                            rowClass,
                            'flex cursor-pointer items-center space-x-2 font-serif',
                          )}
                          onClick={() => {
                            setSelectedProfileAndNavigate(profile.id);
                            close();
                          }}
                        >
                          <User className="h-4" />
                          <span className="truncate">{profile.name}</span>
                        </Link>
                      </DropdownMenuItem>
                      {(profile.role === USER_ROLES.GALLERY ||
                        profile.role === USER_ROLES.ARTIST) && (
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/profiles/${profile.id}/edit`}
                            className={cn(
                              rowClass,
                              'flex cursor-pointer items-center space-x-2 pl-6 text-xs text-muted-foreground',
                            )}
                            onClick={close}
                          >
                            <Settings className="h-3.5 w-3.5 shrink-0" />
                            <span>Edit settings &amp; Find articles</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </div>
                  ))
                : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator className={sepClass} />

          <AdminMenuItem onNavigate={close} />

          <If condition={features.enableThemeToggle}>
            <>
              <DropdownMenuSeparator className={sepClass} />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={cn(rowClass, 'cursor-default justify-between gap-2 font-serif')}
                >
                  <span className="flex items-center space-x-2">
                    <ThemeIcon theme={resolvedTheme} />
                    <span>
                      <Trans i18nKey="common:theme" />
                    </span>
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="z-[320] min-w-[10rem] p-1 font-serif"
                  sideOffset={6}
                  collisionPadding={16}
                >
                  {MODES.map((mode) => {
                    const isSelected = theme === mode;
                    return (
                      <DropdownMenuItem
                        key={mode}
                        className={cn(
                          rowClass,
                          'cursor-pointer font-serif',
                          isSelected && 'bg-muted',
                        )}
                        onSelect={(e) => {
                          e.preventDefault();
                          setTheme(mode);
                          setCookieTheme(mode);
                        }}
                      >
                        <ThemeIcon theme={mode} />
                        <span>
                          <Trans i18nKey={`common:${mode}Theme`} />
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          </If>

          <DropdownMenuSeparator className={sepClass} />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(rowClass, 'cursor-default font-serif')}
            >
              <span className="text-sm font-medium">
                <Trans i18nKey="common:language" defaults="Language" />
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="z-[320] max-h-[min(50vh,20rem)] min-w-[10rem] overflow-y-auto p-1 font-serif"
              sideOffset={6}
              collisionPadding={16}
            >
              {languages.map((locale) => {
                const isSelected = locale === i18n.language;
                return (
                  <DropdownMenuItem
                    key={locale}
                    className={cn(
                      rowClass,
                      'cursor-pointer justify-between font-serif',
                      isSelected && 'bg-muted',
                    )}
                    onSelect={(e) => {
                      e.preventDefault();
                      void languageChanged(locale);
                    }}
                  >
                    <span>{getLanguageLabel(locale)}</span>
                    {isSelected ? <span className="text-xs">✓</span> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator className={sepClass} />

          <DropdownMenuItem
            className={cn(rowClass, 'cursor-pointer font-serif')}
            onSelect={() => {
              close();
              router.push(paths.profileSettings);
            }}
          >
            <Settings className="h-5" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={cn(rowClass, 'cursor-pointer font-serif')}
            onSelect={() => {
              close();
              void signOut.mutateAsync();
            }}
          >
            <LogOut className="h-5" />
            <span>
              <Trans i18nKey="auth:signOut" />
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
