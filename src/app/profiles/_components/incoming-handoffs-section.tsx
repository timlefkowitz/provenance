'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type { IncomingHandoff } from '~/lib/profile-handoff/handoff';
import {
  acceptProfileHandoffInvite,
  declineProfileHandoff,
} from '~/app/claim/profile/_actions/accept-profile-handoff';

/**
 * Certificates or collections someone else built for this user, waiting for them to accept
 * or decline. Nothing joins their profile until they accept.
 */
export function IncomingHandoffsSection({ invites }: { invites: IncomingHandoff[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (invites.length === 0) return null;

  const run = (inviteId: string, action: 'accept' | 'decline') => {
    setBusyId(inviteId);
    startTransition(async () => {
      const result =
        action === 'accept'
          ? await acceptProfileHandoffInvite(inviteId)
          : await declineProfileHandoff({ inviteId });
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(action === 'accept' ? 'Added to your account' : 'Declined');
      router.refresh();
    });
  };

  return (
    <Card id="incoming" className="mb-8 border-wine/40 bg-parchment/80">
      <CardHeader>
        <CardTitle className="font-display text-xl text-wine">Waiting for you</CardTitle>
        <CardDescription className="font-serif">
          People on Provenance have added work for you. Nothing joins your profile until you accept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-wine/10 rounded-md border border-wine/15">
          {invites.map((invite) => {
            const works = invite.works === 1 ? '1 work' : `${invite.works} works`;
            const from = invite.fromName || 'Someone';
            const busy = busyId === invite.inviteId;
            return (
              <li
                key={invite.inviteId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-serif text-ink">
                    {invite.role === 'artist'
                      ? `${from} added ${works} under your name`
                      : `${from} catalogued "${invite.name}" for you`}
                  </p>
                  <p className="font-serif text-xs text-ink/60">
                    {invite.role === 'artist'
                      ? `Certificates of Authenticity as ${invite.name}. Accepting adds them to your artist profile.`
                      : `${works} with Certificates of Ownership. Accepting adds them to your collection.`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => run(invite.inviteId, 'accept')}
                    disabled={busyId !== null}
                    className="font-serif bg-wine text-parchment hover:bg-wine/90"
                  >
                    {busy ? 'Working…' : 'Accept'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(invite.inviteId, 'decline')}
                    disabled={busyId !== null}
                    className="font-serif border-wine/30"
                  >
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
