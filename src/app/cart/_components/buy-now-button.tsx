'use client';

import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { isNativePlatform } from '~/lib/capacitor/is-native';
import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';

/** Straight to Stripe checkout (Apple Pay, Google Pay, card) with just this work. */
export function BuyNowButton({
  artworkId,
  exhibitionId,
  className,
  size = 'md',
}: {
  artworkId: string;
  exhibitionId: string | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [buying, setBuying] = useState(false);

  async function buyNow() {
    setBuying(true);
    try {
      const res = await fetch('/api/stripe/create-cart-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ artworkId, exhibitionId }] }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; signIn?: boolean };
      if (data.url) {
        await openExternalCheckout(data.url);
        if (!isNativePlatform()) return; // navigating to checkout
      } else {
        toast.error(data.error ?? 'Could not start checkout. Please try again.');
        if (data.signIn) {
          window.location.href = `/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
      }
    } catch (err) {
      console.error('[BuyNow] checkout failed', err);
      toast.error('Could not start checkout. Please try again.');
    }
    setBuying(false);
  }

  return (
    <button
      type="button"
      onClick={buyNow}
      disabled={buying}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-editorial-ink font-jetbrains uppercase text-bone hover:bg-vermillion disabled:opacity-60 transition-colors',
        size === 'sm' ? 'px-3 py-1.5 text-[10px] tracking-[0.12em]' : 'px-5 py-2 text-[11px] tracking-[0.14em]',
        className,
      )}
    >
      {buying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Buy now
    </button>
  );
}
