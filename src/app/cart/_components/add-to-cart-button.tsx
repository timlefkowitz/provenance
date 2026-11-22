'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Check, ShoppingBag } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { useCart } from '~/lib/cart/cart-store';

export function AddToCartButton({
  artworkId,
  exhibitionId,
  held,
}: {
  artworkId: string;
  exhibitionId: string;
  /** Another buyer is in checkout with this work right now. */
  held?: boolean;
}) {
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const inCart = cart.has(artworkId);

  if (inCart) {
    return (
      <Link
        href="/cart"
        className="inline-flex items-center gap-1.5 rounded-md border border-wine/30 px-3 py-1.5 text-[11px] uppercase tracking-widest font-serif text-wine hover:bg-wine/5 transition-colors"
      >
        <Check className="h-3.5 w-3.5" />
        In your cart
      </Link>
    );
  }

  if (held) {
    return (
      <p className="text-[11px] font-serif text-ink/50">Someone is checking out this work right now.</p>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || !cart.ready}
      onClick={async () => {
        setBusy(true);
        const res = await cart.add({ artworkId, exhibitionId });
        setBusy(false);
        if (!res.ok) toast.error(res.error ?? 'Could not add to your cart');
        else
          toast.success('Added to your cart', {
            action: { label: 'View cart', onClick: () => (window.location.href = '/cart') },
          });
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-wine px-3 py-1.5 text-[11px] uppercase tracking-widest font-serif text-bone hover:bg-wine/90 disabled:opacity-60 transition-colors"
    >
      <ShoppingBag className="h-3.5 w-3.5" />
      {busy ? 'Adding…' : 'Add to cart'}
    </button>
  );
}
