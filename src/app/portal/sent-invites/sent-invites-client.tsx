'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cancelCertificateClaimInvite } from '~/app/claim/certificate/_actions/manage-owner-invites';

export type SentInviteBatch = {
  batchKey: string;
  claimKind: string;
  artworkTitles: string[];
  inviteeEmail: string;
  expiresAt: string;
};

export function SentInvitesClient({ batches }: { batches: SentInviteBatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleRevoke = (batchKey: string) => {
    startTransition(async () => {
      console.log('[Portal] sent-invites revoke', { batchKey });
      const result = await cancelCertificateClaimInvite(batchKey);
      if (!result.success) {
        toast.error(result.error ?? 'Could not revoke invite');
        return;
      }
      toast.success('Invite revoked');
      router.refresh();
    });
  };

  if (batches.length === 0) {
    return (
      <p className="text-ink/60 font-serif text-center py-8">
        No pending certificate invites sent by you.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {batches.map((batch) => (
        <div
          key={batch.batchKey}
          className="border border-wine/25 rounded-lg p-4 bg-parchment/40"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-xs font-serif text-ink/50 uppercase tracking-wide mb-1">
                {batch.claimKind.replace(/_/g, ' ')}
              </p>
              <p className="text-sm font-serif text-ink/70 mb-1">
                To: <span className="text-ink/90">{batch.inviteeEmail}</span>
              </p>
              <ul className="list-disc pl-5 font-serif text-sm text-ink/90 space-y-0.5">
                {batch.artworkTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="text-xs text-ink/50 mt-2 font-serif">
                Expires {new Date(batch.expiresAt).toLocaleString()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleRevoke(batch.batchKey)}
              className="font-serif border-wine/30 text-wine hover:bg-wine/10 shrink-0"
            >
              {pending ? 'Revoking…' : 'Revoke'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
