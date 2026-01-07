'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { JwtPayload } from '@supabase/supabase-js';
import { ChevronsUpDown, Home, LogOut, Settings, User, Shield } from 'lucide-react';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { SubMenuModeToggle } from '@kit/ui/mode-toggle';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';
import { usePersonalAccountData } from '@kit/accounts/hooks/use-personal-account-data';
import { AdminMenuItem } from './admin-menu-item';

import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

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
  const user = useUser(props.user);
  const userData = user.data;
  const personalAccountData = usePersonalAccountData(userData?.id || '', props.account);

  if (!userData) {
    return null;
  }

  const signedInAsLabel = useMemo(() => {
    const email = userData?.email ?? undefined;
    const phone = userData?.phone ?? undefined;

    return email ?? phone;
  }, [userData]);

  const displayName =
    personalAccountData?.data?.name ?? props.account?.name ?? userData?.email ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open your profile menu"
        className={cn(
          'animate-in fade-in focus:outline-primary flex cursor-pointer items-center duration-500',
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
          pictureUrl={personalAccountData?.data?.picture_url}
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

      <DropdownMenuContent className={'xl:!min-w-[15rem]'}>
        <DropdownMenuItem className={'!h-10 rounded-none'}>
          <div className={'flex flex-col justify-start truncate text-left text-xs'}>
            <div className={'text-muted-foreground'}>
              <Trans i18nKey={'common:signedInAs'} />
            </div>
            <div>
              <span className={'block truncate'}>{signedInAsLabel}</span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            className={'flex cursor-pointer items-center space-x-2'}
            href={paths.home}
          >
            <Home className={'h-5'} />
            <span>
              <Trans i18nKey={'common:routes.home'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            className={'flex cursor-pointer items-center space-x-2'}
            href={paths.profile}
          >
            <User className={'h-5'} />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            className={'flex cursor-pointer items-center space-x-2'}
            href={paths.profileSettings}
          >
            <Settings className={'h-5'} />
            <span>
              <Trans i18nKey={'account:settingsTab'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <AdminMenuItem />

        <DropdownMenuSeparator />

        <If condition={features.enableThemeToggle}>
          <SubMenuModeToggle />
        </If>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          role={'button'}
          className={'cursor-pointer'}
          onClick={() => signOut.mutateAsync()}
        >
          <span className={'flex w-full items-center space-x-2'}>
            <LogOut className={'h-5'} />
            <span>
              <Trans i18nKey={'auth:signOut'} />
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
