'use client';

import { useCallback, useMemo } from 'react';
import { User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@kit/ui/dropdown-menu';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';
import { useUser } from '@kit/supabase/hooks/use-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { updateUserRole } from '~/app/onboarding/_actions/update-user-role';
import { USER_ROLES, getRoleLabel, getUserRole, type UserRole } from '~/lib/user-roles';

const ROLES = [
  { value: USER_ROLES.COLLECTOR, label: getRoleLabel(USER_ROLES.COLLECTOR) },
  { value: USER_ROLES.ARTIST, label: getRoleLabel(USER_ROLES.ARTIST) },
  { value: USER_ROLES.GALLERY, label: getRoleLabel(USER_ROLES.GALLERY) },
] as const;

export function RoleSwitcher() {
  const router = useRouter();
  const { data: user } = useUser();
  const client = useSupabase();
  const [pending, startTransition] = useTransition();

  // Fetch account data to get current role
  const { data: account } = useQuery({
    queryKey: ['account:role', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return null;

      const { data, error } = await client
        .from('accounts')
        .select('public_data')
        .eq('id', user.sub)
        .single();

      if (error) {
        console.error('Error fetching account:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.sub,
  });

  const currentRole = useMemo(() => {
    if (!account?.public_data) return null;
    return getUserRole(account.public_data as Record<string, any>);
  }, [account]);

  const roleChanged = useCallback(
    async (role: UserRole) => {
      if (role === currentRole || !user?.sub) {
        return;
      }

      startTransition(async () => {
        try {
          await updateUserRole(role);
          router.refresh();
        } catch (error) {
          console.error('Error updating role:', error);
        }
      });
    },
    [currentRole, user?.sub, router],
  );

  // Don't render if user is not logged in
  if (!user) {
    return null;
  }

  const MenuItems = useMemo(
    () =>
      ROLES.map((roleOption) => {
        const isSelected = roleOption.value === currentRole;

        return (
          <DropdownMenuItem
            className={cn('flex cursor-pointer items-center space-x-2', {
              'bg-muted': isSelected,
            })}
            key={roleOption.value}
            onClick={() => roleChanged(roleOption.value)}
            disabled={pending}
          >
            <span className="flex items-center justify-between w-full">
              <span>{roleOption.label}</span>
              {isSelected && (
                <span className="ml-2 text-xs">✓</span>
              )}
            </span>
          </DropdownMenuItem>
        );
      }),
    [currentRole, roleChanged, pending],
  );

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className={
            'hidden w-full items-center justify-between gap-x-3 lg:flex'
          }
        >
          <span className={'flex space-x-2'}>
            <User className="h-4" />
            <span>
              <Trans i18nKey={'common:role'} defaults={'Role'} />
            </span>
          </span>
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent>{MenuItems}</DropdownMenuSubContent>
      </DropdownMenuSub>

      <div className={'lg:hidden'}>
        <DropdownMenuLabel>
          <Trans i18nKey={'common:role'} defaults={'Role'} />
        </DropdownMenuLabel>

        {MenuItems}
      </div>
    </>
  );
}

