'use client';

import { useEffect } from 'react';

import { useCart } from '~/lib/cart/cart-store';

/** Drop the works just bought from this browser's cart (the webhook empties the account cart). */
export function ClearPurchasedFromCart({ artworkIds }: { artworkIds: string[] }) {
  const cart = useCart();
  const key = artworkIds.join(',');
  useEffect(() => {
    if (!cart.ready || artworkIds.length === 0) return;
    if (artworkIds.some((id) => cart.has(id))) void cart.remove(artworkIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, key]);
  return null;
}
