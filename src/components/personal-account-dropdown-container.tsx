'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JwtPayload } from '@supabase/supabase-js';
import { ChevronsUpDown, Home, LogOut, Settings, User, Check } from 'lucide-react';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useCurrentUser } from '~/hooks/use-current-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { SubMenuModeToggle } from '@kit/ui/mode-toggle';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';
import type { AppDatabase } from '~/lib/supabase-app-database';
import { AdminMenuItem } from './admin-menu-item';
import { LanguageSwitcher } from './language-switcher';
import { getPerspective } from './perspective-switcher';
import { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';

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

  // Fetch account display data (name, picture) directly — avoids React Query monorepo
  // instance mismatch that can occur with kit hooks like usePersonalAccountData.
  const [accountData, setAccountData] = useState<{
    name: string | null;
    picture_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userData?.id) return;
    console.log('[ProfileDropdown] Fetching account data for', userData.id);
    client
      .from('accounts')
      .select('name, picture_url')
      .eq('id', userData.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileDropdown] Error fetching account data', error);
          return;
        }
        if (data) setAccountData(data);
      });
  }, [userData?.id, client]);

  // Fetch all user profiles directly — same reason as above.
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!userData?.id) return;
    console.log('[ProfileDropdown] Fetching user profiles for', userData.id);
    client
      .from('user_profiles')
      .select('*')
      .eq('user_id', userData.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileDropdown] Error fetching profiles', error);
          return;
        }
        setProfiles((data || []) as UserProfile[]);
      });
  }, [userData?.id, client]);

  // Current role/perspective (synced with PerspectiveSwitcher)
  const [currentPerspective, setCurrentPerspective] = useState<UserRole>(USER_ROLES.ARTIST);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPerspective(getPerspective());
    }
  }, []);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PERSPECTIVE_KEY, role);
        localStorage.removeItem(SELECTED_PROFILE_KEY);
        window.dispatchEvent(
          new CustomEvent('user_perspective_changed', { detail: role }),
        );
      }
      setCurrentPerspective(role);
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

  if (!userData) {
    return null;
  }

  const displayName =
    accountData?.name ?? props.account?.name ?? userData?.email ?? '';

  // When in gallery mode, show the active gallery's picture; otherwise show the
  // Google OAuth avatar so the icon clearly reflects the current context.
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
    <DropdownMenu modal={false}>
      {/*
        Do not use asChild here: Radix Slot + ref merge can fail on React 19,
        leaving the trigger inert. Let DropdownMenuTrigger render its own button.
      */}
      <DropdownMenuTrigger
        type="button"
        aria-label="Open your profile menu"
        className={cn(
          'focus:outline-primary relative z-10 flex cursor-pointer items-center border-0 bg-transparent p-0 outline-none',
          {
            ['active:bg-secondary/50 items-center gap-x-4 rounded-md' +
            ' hover:bg-secondary p-2 transition-colors']: props.showProfileName,
          },
        )}
      >
        <ProfileAvatar
          className={'rounded-md'}
          fallbackClassName={'rounded-md border'}
          displayName={displayName ?? userData?.email ?? ''}
          pictureUrl={profilePictureUrl}
        />

        <If condition={props.showProfileName}>
          <div className={'fade-in animate-in flex w-full flex-col truncate text-left'}>
            <span className={'truncate text-sm'}>
              {displayName}
            </span>
            <span className={'text-muted-foreground truncate text-xs'}>
              {signedInAsLabel}
            </span>
          </div>

          <ChevronsUpDown className={'text-muted-foreground mr-1 h-8'} />
        </If>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={16}
        className="z-[100] min-w-[14rem]"
      >
        <DropdownMenuItem asChild>
          <Link
            className={'flex cursor-pointer items-center space-x-2'}
            href={paths.home}
          >
            <Home className={'h-5'} />
            <span>Home</span>
          </Link>
        </DropdownMenuItem>

        {/* Profile submenu: show current role (Artist/Collector/Gallery) and switch + profiles */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex cursor-pointer items-center space-x-2">
            <User className={'h-5'} />
            <span>Profile</span>
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {getRoleLabel(currentPerspective)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-[110] min-w-[12rem]">
            <DropdownMenuLabel className="text-muted-foreground font-normal">
              Viewing as: {getRoleLabel(currentPerspective)}
            </DropdownMenuLabel>
            <DropdownMenuItem
              className={cn(
                'flex cursor-pointer items-center justify-between',
                currentPerspective === USER_ROLES.ARTIST && 'bg-muted',
              )}
              onClick={() => switchRole(USER_ROLES.ARTIST)}
            >
              <span>{getRoleLabel(USER_ROLES.ARTIST)}</span>
              {currentPerspective === USER_ROLES.ARTIST && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                'flex cursor-pointer items-center justify-between',
                currentPerspective === USER_ROLES.COLLECTOR && 'bg-muted',
              )}
              onClick={() => switchRole(USER_ROLES.COLLECTOR)}
            >
              <span>{getRoleLabel(USER_ROLES.COLLECTOR)}</span>
              {currentPerspective === USER_ROLES.COLLECTOR && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                'flex cursor-pointer items-center justify-between',
                currentPerspective === USER_ROLES.GALLERY && 'bg-muted',
              )}
              onClick={() => switchRole(USER_ROLES.GALLERY)}
            >
              <span>{getRoleLabel(USER_ROLES.GALLERY)}</span>
              {currentPerspective === USER_ROLES.GALLERY && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                className={'flex cursor-pointer items-center space-x-2'}
                href={paths.profile}
              >
                <User className={'h-4'} />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            {profilesForCurrentRole.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {profilesForCurrentRole.map((profile) => (
                  <DropdownMenuItem key={profile.id} asChild>
                    <Link
                      className={'flex cursor-pointer items-center space-x-2'}
                      href={
                        currentPerspective === USER_ROLES.GALLERY
                          ? `/artists/${userData.id}?role=gallery&profileId=${profile.id}`
                          : `/artists/${userData.id}?role=${currentPerspective}`
                      }
                      onClick={() => setSelectedProfileAndNavigate(profile.id)}
                    >
                      <User className={'h-4'} />
                      <span className="truncate">{profile.name}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <AdminMenuItem />

        <DropdownMenuSeparator />

        <If condition={features.enableThemeToggle}>
          <SubMenuModeToggle />
        </If>

        <LanguageSwitcher />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex cursor-pointer items-center space-x-2"
          onSelect={() => router.push(paths.profileSettings)}
        >
          <Settings className="h-5" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          role={'button'}
          className={'cursor-pointer'}
          onClick={() => signOut.mutateAsync()}
        >
          <span className={'flex w-full items-center space-x-2'}>
            <LogOut className={'h-5'} />
            <span>Sign Out</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
