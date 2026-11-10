'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import pathsConfig from '~/config/paths.config';
import { USER_ROLES } from '~/lib/user-roles';

import { acceptInstitutionInvite } from '../_actions/institution-invite';

const PERSPECTIVE_KEY = 'user_perspective';

export function AcceptInstitutionInviteButton({
  token,
  inviteEmail,
  signedInEmail,
  alreadyAccepted,
}: {
  token: string;
  inviteEmail: string;
  signedInEmail: string;
  alreadyAccepted: boolean;
}) {
  const router = useRouter();
  const signOut = useSignOut();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const emailMatches = signedInEmail.toLowerCase() === inviteEmail.toLowerCase();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInstitutionInvite(token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Switch this device to institution mode right away.
      try {
        localStorage.setItem(PERSPECTIVE_KEY, USER_ROLES.INSTITUTION);
        document.cookie = `${PERSPECTIVE_KEY}=${USER_ROLES.INSTITUTION}; path=/; max-age=31536000; samesite=lax`;
        window.dispatchEvent(
          new CustomEvent('user_perspective_changed', { detail: USER_ROLES.INSTITUTION }),
        );
      } catch {
        // Storage can be blocked; the account's mode is already set server-side.
      }
      setDone(true);
      router.replace(res.redirectTo);
      router.refresh();
    });
  }

  async function handleSwitchAccount() {
    await signOut.mutateAsync();
    const next = `/institution-invite?token=${encodeURIComponent(token)}`;
    router.replace(`${pathsConfig.auth.signIn}?next=${encodeURIComponent(next)}`);
  }

  if (!emailMatches) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/80">
          This invitation is for <strong>{inviteEmail}</strong>, but you&apos;re signed in as{' '}
          <strong>{signedInEmail || 'another account'}</strong>.
        </p>
        <Button
          type="button"
          variant="outline"
          className="border-wine/30"
          disabled={signOut.isPending}
          onClick={handleSwitchAccount}
        >
          Sign in as {inviteEmail}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={handleAccept}
        disabled={isPending || done}
        className="w-full bg-wine text-parchment hover:bg-wine/90 sm:w-auto"
      >
        {done ? 'Opening…' : isPending ? 'Joining…' : alreadyAccepted ? 'Continue' : 'Accept invitation'}
      </Button>
      <p className="text-xs text-ink/60">Signed in as {signedInEmail}.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
