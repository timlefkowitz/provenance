'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import { formatPrice } from '~/lib/cart/format';

import { AddToCartButton } from './add-to-cart-button';

/** Price, Buy now and Add to cart on a certificate whose work is for sale. */
export function CertificateBuyBox({
  artworkId,
  exhibitionId,
  exhibitionTitle,
  priceCents,
  currency,
  held,
}: {
  artworkId: string;
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  priceCents: number;
  currency: string;
  held: boolean;
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
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        await openExternalCheckout(data.url);
        if (!isNativePlatform()) return; // navigating to checkout
      } else {
        toast.error(data.error ?? 'Could not start checkout. Please try again.');
      }
    } catch (err) {
      console.error('[CertificateBuyBox] buy now failed', err);
      toast.error('Could not start checkout. Please try again.');
    }
    setBuying(false);
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-wine/15 bg-parchment/60 px-5 py-4">
        <div>
          <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">For sale</p>
          <p className="font-display text-2xl text-ink">{formatPrice(priceCents, currency)}</p>
          {exhibitionId && exhibitionTitle && (
            <p className="font-serif text-xs text-ink/50">
              Through{' '}
              <Link href={`/exhibitions/${exhibitionId}`} className="hover:text-wine underline-offset-2 hover:underline">
                {exhibitionTitle}
              </Link>
            </p>
          )}
        </div>
        {held ? (
          <p className="font-serif text-sm text-ink/55">Someone is checking out this work right now.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton artworkId={artworkId} exhibitionId={exhibitionId} />
            <button
              type="button"
              onClick={buyNow}
              disabled={buying}
              className="inline-flex items-center gap-2 rounded-md bg-editorial-ink px-5 py-2 font-jetbrains text-[11px] uppercase tracking-[0.14em] text-bone hover:bg-vermillion disabled:opacity-60 transition-colors"
            >
              {buying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Buy now
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 text-right font-serif text-[11px] text-ink/45">
        Apple Pay, Google Pay or card. You receive the work’s Certificate of Ownership.
      </p>
    </div>
  );
}
