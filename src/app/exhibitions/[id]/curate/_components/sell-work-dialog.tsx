'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { BadgeDollarSign, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { sellExhibitionWork } from '~/app/exhibitions/_actions/sell-exhibition-work';

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Mark a work in the show sold and send the buyer a Certificate of Ownership. */
export function SellWorkDialog({
  exhibitionId,
  artworkId,
  artworkTitle,
  defaultPriceCents = null,
}: {
  exhibitionId: string;
  artworkId: string;
  artworkTitle: string;
  /** The work's set value, prefilled as the sale price. */
  defaultPriceCents?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const initialPrice = defaultPriceCents ? String(defaultPriceCents / 100) : '';
  const [price, setPrice] = useState(initialPrice);
  const [soldOn, setSoldOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    let priceCents: number | null = null;
    const priceText = price.replace(/[$,\s]/g, '');
    if (priceText) {
      const value = Number(priceText);
      if (!Number.isFinite(value) || value < 0) {
        setError('Enter a price in numbers, e.g. 1200 or 1200.50');
        return;
      }
      priceCents = Math.round(value * 100);
    }

    startTransition(async () => {
      const result = await sellExhibitionWork({
        exhibitionId,
        artworkId,
        buyerEmail: email,
        buyerName: name.trim() || null,
        priceCents,
        soldOn,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.certificateSent) {
        toast.success(
          `Marked sold. ${email.trim()} was sent their Certificate of Ownership to claim.`,
        );
      } else {
        toast.warning('Marked sold, but the Certificate of Ownership was not sent.', {
          description:
            result.inviteError ??
            'An open invite may already exist for this email. You can issue it from the certificate page.',
          duration: 10000,
        });
      }
      setOpen(false);
      setEmail('');
      setName('');
      setPrice(initialPrice);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-wine/30 hover:bg-wine/10 h-8 gap-1.5 font-serif"
        >
          <BadgeDollarSign className="h-3.5 w-3.5" />
          Mark sold
        </Button>
      </DialogTrigger>
      <DialogContent className="font-serif sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            Mark sold
          </DialogTitle>
          <DialogDescription>
            Records the sale of &quot;{artworkTitle}&quot; and emails the buyer
            a Certificate of Ownership to claim into their collection.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="sell-buyer-email">Buyer email</Label>
            <Input
              id="sell-buyer-email"
              type="email"
              required
              autoComplete="off"
              placeholder="collector@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sell-buyer-name">
              Buyer name{' '}
              <span className="text-ink/40 font-normal">(optional)</span>
            </Label>
            <Input
              id="sell-buyer-name"
              autoComplete="off"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sell-price">
                Price, USD{' '}
                <span className="text-ink/40 font-normal">(optional)</span>
              </Label>
              <Input
                id="sell-price"
                inputMode="decimal"
                placeholder="1200"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sell-date">Sale date</Label>
              <Input
                id="sell-date"
                type="date"
                value={soldOn}
                max={today()}
                onChange={(e) => setSoldOn(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !email.trim()}
              className="bg-wine text-parchment hover:bg-wine/90 gap-1.5 font-serif"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? 'Recording sale…' : 'Mark sold & send certificate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
