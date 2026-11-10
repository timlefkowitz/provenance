'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type { OpenHandoffInvite } from '~/lib/profile-handoff/handoff';
import { cancelProfileHandoffInvite } from '../_actions/send-profile-handoff';

/** Where a managed profile's handoff stands, with a way to withdraw a live invite. */
export function HandoffStatus({
  profileId,
  invite,
  draftLabel,
}: {
  profileId: string;
  invite: OpenHandoffInvite | undefined;
  /** Shown when nothing has been sent yet */
  draftLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!invite) {
    return (
      <Badge variant="outline" className="font-serif text-xs">
        {draftLabel}
      </Badge>
    );
  }

  const who = invite.recipientName ?? invite.email ?? 'them';
  const label =
    invite.status === 'declined'
      ? `Declined by ${who}`
      : invite.recipientUserId
        ? `Waiting for ${who} to accept`
        : `Invite sent to ${who}`;

  const withdraw = () => {
    startTransition(async () => {
      const result = await cancelProfileHandoffInvite(profileId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <span className="flex items-center gap-1">
      <Badge
        variant="outline"
        className={`font-serif text-xs ${invite.status === 'declined' ? 'border-destructive/40 text-destructive' : ''}`}
      >
        {label}
      </Badge>
      {invite.status === 'sent' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 font-serif text-xs text-ink/60"
          onClick={withdraw}
          disabled={isPending}
        >
          Withdraw
        </Button>
      )}
    </span>
  );
}
