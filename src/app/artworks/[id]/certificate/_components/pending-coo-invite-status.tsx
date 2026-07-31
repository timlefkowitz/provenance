'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  getPendingOwnerInvitesForArtwork,
  cancelCertificateClaimInvite,
  type PendingOwnerInvite,
} from '~/app/claim/certificate/_actions/manage-owner-invites';

type Props = {
  artworkId: string;
};

export function PendingCooInviteStatus({ artworkId }: Props) {
  const [invites, setInvites] = useState<PendingOwnerInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = () => {
    void getPendingOwnerInvitesForArtwork(artworkId).then((data) => {
      setInvites(data);
      setLoaded(true);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkId]);

  if (!loaded || invites.length === 0) return null;

  // Deduplicate by batch_id so each batch shows once
  const seen = new Set<string>();
  const groups: PendingOwnerInvite[] = [];
  for (const inv of invites) {
    const key = inv.batchId ?? inv.id;
    if (!seen.has(key)) {
      seen.add(key);
      groups.push(inv);
    }
  }

  const handleRevoke = (inv: PendingOwnerInvite) => {
    startTransition(async () => {
      const key = inv.batchId ?? inv.id;
      const result = await cancelCertificateClaimInvite(key);
      if (!result.success) {
        toast.error(result.error ?? 'Could not revoke invite');
        return;
      }
      toast.success('Certificate invite revoked');
      load();
    });
  };

  return (
    <div className="mt-3 space-y-2">
      {groups.map((inv) => (
        <div
          key={inv.batchId ?? inv.id}
          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-wine/20 bg-parchment/40 px-3 py-2 text-sm font-serif"
        >
          <div className="flex-1 min-w-0">
            <span className="text-ink/60 text-xs uppercase tracking-wide mr-2">Pending invite</span>
            <span className="text-ink/90 break-all">{inv.inviteeEmail}</span>
            <span className="text-ink/40 ml-2 text-xs">
              expires {new Date(inv.expiresAt).toLocaleDateString()}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => handleRevoke(inv)}
            className="shrink-0 font-serif border-wine/30 text-wine hover:bg-wine/10"
          >
            {pending ? 'Revoking…' : 'Revoke'}
          </Button>
        </div>
      ))}
    </div>
  );
}
