'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { formatCents, parseMoneyToCents } from '~/lib/auctions/bid-rules';

import { placeBid } from '../_actions/place-bid';

/** Remount it with `key={nextMinCents}` so a new minimum resets the suggested amount. */
export function LotBidPanel({
  lotId,
  auctionId,
  nextMinCents,
  currency,
  signedIn,
  isSeller,
  viewerStatus,
  biddingOpen,
}: {
  lotId: string;
  auctionId: string;
  nextMinCents: number;
  currency: string;
  signedIn: boolean;
  isSeller: boolean;
  viewerStatus: 'leading' | 'outbid' | 'won' | 'lost' | null;
  biddingOpen: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((nextMinCents / 100).toString());
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!biddingOpen) return null;
  if (isSeller) {
    return <p className="font-serif text-xs text-ink/50">Your lot — you can’t bid on it.</p>;
  }
  if (!signedIn) {
    return (
      <Link href={`/auth/sign-in?next=/auctions/${auctionId}`}>
        <Button size="sm" variant="outline" className="w-full font-serif border-wine/30">
          Sign in to bid
        </Button>
      </Link>
    );
  }
  if (viewerStatus === 'leading') {
    return <p className="font-serif text-sm text-notify-success">You’re the high bidder</p>;
  }

  const cents = parseMoneyToCents(amount);
  const valid = cents != null && cents >= nextMinCents;

  const submit = () => {
    if (!valid) return;
    start(async () => {
      const res = await placeBid(lotId, cents!);
      setConfirming(false);
      if (res.success) {
        toast.success(
          res.extended
            ? `Bid placed: ${formatCents(res.currentBidCents, currency)}. Closing time extended.`
            : `Bid placed: ${formatCents(res.currentBidCents, currency)}`,
        );
        setAmount((res.nextMinCents / 100).toString());
      } else {
        toast.error(res.error);
        if (res.nextMinCents) setAmount((res.nextMinCents / 100).toString());
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {viewerStatus === 'outbid' && <p className="font-serif text-xs text-wine">You’ve been outbid</p>}
      {!confirming ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink/50">$</span>
            <Input
              inputMode="decimal"
              aria-label="Bid amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-6"
            />
          </div>
          <Button size="sm" disabled={!valid || pending} onClick={() => setConfirming(true)} className="font-serif">
            Bid
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-wine/20 bg-wine/5 p-2.5">
          <p className="font-serif text-sm text-ink">
            Bid {formatCents(cents, currency)}? Bids are binding: if you win, you agree to buy at this price.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={submit} disabled={pending} className="font-serif">
              {pending ? 'Placing…' : 'Confirm bid'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p className="font-serif text-xs text-ink/50">Minimum bid {formatCents(nextMinCents, currency)}</p>
    </div>
  );
}
