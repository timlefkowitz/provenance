'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';

import { useUser } from '@kit/supabase/hooks/use-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { updateUserRole } from '~/app/onboarding/_actions/update-user-role';
import { USER_ROLES, getRoleLabel, getUserRole, type UserRole } from '~/lib/user-roles';

const ROLES = [
  { value: USER_ROLES.COLLECTOR, label: getRoleLabel(USER_ROLES.COLLECTOR) },
  { value: USER_ROLES.ARTIST, label: getRoleLabel(USER_ROLES.ARTIST) },
  { value: USER_ROLES.GALLERY, label: getRoleLabel(USER_ROLES.GALLERY) },
] as const;

export function RoleSelectionModal() {
  const router = useRouter();
  const { data: user } = useUser();
  const client = useSupabase();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  // Fetch account data to check if user has a role
  const { data: account } = useQuery({
    queryKey: ['account:role-check', user?.sub],
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
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Check if user needs to select a role
  useEffect(() => {
    if (user?.sub && account) {
      const userRole = getUserRole(account.public_data as Record<string, any>);
      // Show modal if user is logged in but doesn't have a role
      setOpen(!userRole);
    } else {
      setOpen(false);
    }
  }, [user, account]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!role) {
      setError('Please select a role.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await updateUserRole(role);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError('Something went wrong. Please try again.');
      }
    });
  };

  // Don't render if user is not logged in or already has a role
  if (!user || !open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-wine">
            Welcome to Provenance
          </DialogTitle>
          <DialogDescription className="text-stone-600 font-body">
            Please select your role to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">I am a...</Label>
            <Select onValueChange={setRole} value={role}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((roleOption) => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Saving...' : 'Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

