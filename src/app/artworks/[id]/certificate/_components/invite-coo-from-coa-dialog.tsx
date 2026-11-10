'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { createOwnerInviteFromCoa } from '~/app/claim/certificate/_actions/create-owner-invite-from-coa';

/** Dollars typed by the sender → cents; blank or invalid is no price. */
function toCents(text: string): number | null {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/**
 * Issue a Certificate of Ownership: emails the collector a claim link and
 * records the sale (at the price entered, else counted at the work's set value).
 */
export function InviteCooFromCoaDialog({
  artworkId,
  artworkTitle,
  isShowCertificate = false,
  defaultPriceCents = null,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  artworkId: string;
  artworkTitle: string;
  isShowCertificate?: boolean;
  /** The work's set value, prefilled as the sale price. */
  defaultPriceCents?: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(defaultPriceCents ? String(defaultPriceCents / 100) : '');
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="font-serif border-wine/30 hover:bg-wine/10"
          >
            Issue Certificate of Ownership
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Issue Certificate of Ownership</DialogTitle>
          <DialogDescription>
            Records the sale of &quot;{artworkTitle}&quot; and emails the collector a link to claim
            their Certificate of Ownership. Your Certificate of{' '}
            {isShowCertificate ? 'Show' : 'Authenticity'} stays in your account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="invite-coo-email">Collector email</Label>
            <Input
              id="invite-coo-email"
              type="email"
              autoComplete="email"
              placeholder="collector@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-serif"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-coo-name">Collector name <span className="text-ink/40 font-normal">(optional)</span></Label>
            <Input
              id="invite-coo-name"
              type="text"
              autoComplete="name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-serif"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-coo-price">
              Sale price (USD) <span className="text-ink/40 font-normal">(optional)</span>
            </Label>
            <Input
              id="invite-coo-price"
              inputMode="decimal"
              placeholder="1200"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="font-serif"
            />
            <p className="text-xs text-ink/50">
              Private to you and your team. Left blank, the sale counts at the work&apos;s set value in your
              stats.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                console.log('[Certificates] InviteCooFromCoaDialog submit', { artworkId });
                const result = await createOwnerInviteFromCoa(
                  artworkId,
                  email,
                  name.trim() || undefined,
                  toCents(price),
                );
                if (!result.success) {
                  toast.error(result.emailFailed ? 'Email not delivered' : result.error, {
                    description: result.emailFailed
                      ? `${result.error}. Check the address and try again.`
                      : undefined,
                    duration: result.emailFailed ? 10000 : undefined,
                  });
                  return;
                }
                toast.success('Sale recorded and Certificate of Ownership sent. The collector claims it from their email.');
                setOpen(false);
                setEmail('');
                setName('');
              });
            }}
          >
            {pending ? 'Sending…' : 'Record sale & send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
