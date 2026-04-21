'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { consumeCertificateClaimByBatchId } from '~/app/claim/certificate/_actions/consume-certificate-claim';

export type PendingBatch = {
  batchKey: string;
  claimKind: string;
  artworkTitles: string[];
  expiresAt: string;
};

export function PendingClaimsClient({ batches }: { batches: PendingBatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAccept = (batchKey: string) => {
    startTransition(async () => {
      console.log('[Portal] pending-claims accept', { batchKey });
      const result = await consumeCertificateClaimByBatchId(batchKey);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Certificates claimed');
      router.push(`/artworks/${result.artworkId}/certificate`);
      router.refresh();
    });
  };

  if (batches.length === 0) {
    return (
      <p className="text-ink/60 font-serif text-center py-8">
        No pending certificate invites.
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
              disabled={pending}
              onClick={() => handleAccept(batch.batchKey)}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0"
            >
              {pending ? 'Working…' : 'Accept all'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
