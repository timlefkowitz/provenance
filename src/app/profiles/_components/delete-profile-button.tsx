'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { toast } from '@kit/ui/sonner';
import { getRoleLabel } from '~/lib/user-roles';
import { deleteProfile } from '../_actions/delete-profile';

interface Props {
  profileId: string;
  profileName: string;
  profileRole: string;
}

export function DeleteProfileButton({ profileId, profileName, profileRole }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      try {
        console.log('[DeleteProfileButton] Deleting profile', profileId);
        const result = await deleteProfile(profileId);
        if (result.error) {
          toast.error(result.error);
          setOpen(false);
          return;
        }
        toast.success(`"${profileName}" profile deleted`);
        router.push('/profiles');
      } catch (err) {
        console.error('[DeleteProfileButton] Error deleting profile', err);
        toast.error('Something went wrong. Please try again.');
        setOpen(false);
      }
    });
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h3 className="font-display text-base font-semibold text-destructive mb-1">
        Remove Profile
      </h3>
      <p className="text-sm font-serif text-ink/60 mb-4">
        Remove this {getRoleLabel(profileRole).toLowerCase()} profile from your account. All your
        data — exhibitions, artworks, open calls — is kept safe and will not be deleted.
      </p>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground font-serif"
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Remove this profile
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {getRoleLabel(profileRole)} Profile</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Remove{' '}
                  <span className="font-semibold text-ink">&ldquo;{profileName}&rdquo;</span>{' '}
                  from your account?
                </p>
                <p className="text-ink/70">
                  Your exhibitions, artworks, and open calls are <span className="font-semibold">completely safe</span> — nothing
                  is deleted. Only the profile page itself is removed.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Removing…' : 'Yes, remove this profile'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
