'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, RotateCcw } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { restoreCertificate, voidCertificate } from '../../_actions/void-certificate';

/** Toolbar button + confirm dialog that voids a certificate into the Archive. */
export function VoidCertificateButton({
  artworkId,
  artworkTitle,
}: {
  artworkId: string;
  artworkTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  const handleVoid = () => {
    startTransition(async () => {
      const result = await voidCertificate(artworkId, reason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success('Certificate voided and moved to your Archive.');
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-serif text-xs sm:text-sm gap-1.5 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden />
          Void
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-wine">Void this certificate?</AlertDialogTitle>
          <AlertDialogDescription className="font-serif">
            <strong>{artworkTitle}</strong> will leave your collection, the registry and public pages,
            and move to your Archive. Anyone who scans its QR code will see that it has been voided.
            You can restore it from the Archive later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="void-reason" className="text-xs font-serif text-ink/60">
            Reason (optional, only you see this)
          </label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Issued with the wrong dimensions; reissued as a new certificate."
            className="font-serif text-sm"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="font-serif">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleVoid();
            }}
            disabled={pending}
            className="bg-red-700 hover:bg-red-800 text-white font-serif"
          >
            {pending ? 'Voiding…' : 'Void certificate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Restore button shared by the voided banner and the Archive list. */
export function RestoreCertificateButton({
  artworkId,
  className,
}: {
  artworkId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      className={className ?? 'font-serif text-xs sm:text-sm gap-1.5'}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreCertificate(artworkId);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success('Certificate restored.');
          router.refresh();
        })
      }
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      {pending ? 'Restoring…' : 'Restore'}
    </Button>
  );
}

/** Banner the holder sees on a voided certificate. */
export function VoidedCertificateBanner({
  artworkId,
  voidedAt,
  reason,
  canRestore,
}: {
  artworkId: string;
  voidedAt: string | null;
  reason: string | null;
  canRestore: boolean;
}) {
  const voidedOn = voidedAt
    ? new Date(voidedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <Ban className="h-5 w-5 shrink-0" aria-hidden />
        <div className="flex-1 font-serif text-sm">
          <p className="font-semibold">
            This certificate is void{voidedOn ? ` (since ${voidedOn})` : ''}.
          </p>
          <p className="text-red-900/75">
            It is hidden from your collection and the registry, and its QR code shows it as voided.{' '}
            <Link href="/artworks/archive" className="underline underline-offset-2">
              View Archive
            </Link>
          </p>
          {reason ? <p className="mt-1 text-red-900/75 italic">Reason: {reason}</p> : null}
        </div>
        {canRestore ? <RestoreCertificateButton artworkId={artworkId} /> : null}
      </div>
    </div>
  );
}
