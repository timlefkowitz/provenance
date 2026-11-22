'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { Image as ImageIcon, Loader2, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { isNativePlatform } from '~/lib/capacitor/is-native';
import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';
import { useCart } from '~/lib/cart/cart-store';
import { formatPrice, UNAVAILABLE_LABEL } from '~/lib/cart/format';

import { type CartDisplayItem, resolveCartForDisplay } from '../_actions/resolve-cart';

export function CartView() {
  const cart = useCart();
  const [items, setItems] = useState<CartDisplayItem[] | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const linesKey = cart.lines.map((l) => l.artworkId).join(',');

  useEffect(() => {
    if (!cart.ready) return;
    let cancelled = false;
    resolveCartForDisplay(cart.lines)
      .then((r) => !cancelled && setItems(r))
      .catch((err) => {
        console.error('[Cart] resolve failed', err);
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, linesKey]);

  // iOS: checkout runs in an in-app Safari sheet; re-read the cart when it closes.
  useEffect(() => {
    if (!isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/browser').then(async ({ Browser }) => {
      const handle = await Browser.addListener('browserFinished', () => {
        setCheckingOut(false);
        void cart.refresh();
      });
      remove = () => void handle.remove();
    });
    return () => remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const available = useMemo(() => (items ?? []).filter((i) => i.available), [items]);
  const unavailable = useMemo(() => (items ?? []).filter((i) => !i.available), [items]);
  const currency = available[0]?.currency ?? 'usd';
  const total = available.reduce((a, i) => a + i.priceCents, 0);

  async function checkout() {
    setCheckingOut(true);
    try {
      const res = await fetch('/api/stripe/create-cart-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: available.map((i) => ({ artworkId: i.artworkId, exhibitionId: i.exhibitionId })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        unavailable?: Array<{ artworkId: string; reason: string }>;
      };
      if (data.url) {
        await openExternalCheckout(data.url);
        if (!isNativePlatform()) return; // page is navigating away
      } else {
        toast.error(data.error ?? 'Could not start checkout. Please try again.');
        if (data.unavailable?.length) {
          setItems(await resolveCartForDisplay(cart.lines));
        }
      }
    } catch (err) {
      console.error('[Cart] checkout failed', err);
      toast.error('Could not start checkout. Please try again.');
    }
    setCheckingOut(false);
  }

  if (!cart.ready || (cart.count > 0 && items === null)) {
    return (
      <div className="flex items-center gap-2 py-16 font-serif text-sm text-ink/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your cart…
      </div>
    );
  }

  if (cart.count === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-ink/60">Your cart is empty.</p>
        <p className="mt-2 font-serif text-sm text-ink/45">
          Works for sale in exhibitions have an “Add to cart” button.
        </p>
        <Link href="/artworks" className="mt-6 inline-block font-serif text-sm text-wine hover:underline">
          Browse artworks
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_280px]">
      <ul className="divide-y divide-wine/10 border-y border-wine/10">
        {[...available, ...unavailable].map((item) => (
          <li key={item.artworkId} className="flex gap-4 py-4">
            <Link href={`/artworks/${item.artworkId}/certificate`} className="shrink-0">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="h-24 w-24 rounded object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded bg-wine/5">
                  <ImageIcon className="h-6 w-6 text-wine/25" />
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="font-serif font-semibold text-ink">{item.title}</p>
              {item.artistName && <p className="font-serif text-sm text-ink/65">{item.artistName}</p>}
              {item.exhibitionTitle && (
                <Link
                  href={`/exhibitions/${item.exhibitionId}`}
                  className="font-serif text-xs text-ink/45 hover:text-wine"
                >
                  {item.exhibitionTitle}
                </Link>
              )}
              {!item.available && item.reason && (
                <p className="mt-1 font-serif text-xs text-vermillion">{UNAVAILABLE_LABEL[item.reason]}</p>
              )}
            </div>
            <div className="flex flex-col items-end justify-between">
              <span className={item.available ? 'font-serif text-ink' : 'font-serif text-ink/35 line-through'}>
                {item.priceCents > 0 ? formatPrice(item.priceCents, item.currency) : '—'}
              </span>
              <button
                type="button"
                onClick={() => void cart.remove(item.artworkId)}
                className="inline-flex items-center gap-1 font-serif text-xs text-ink/45 hover:text-wine"
                aria-label={`Remove ${item.title} from cart`}
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-lg bg-parchment/60 p-5">
        <div className="flex items-baseline justify-between font-serif">
          <span className="text-ink/60">
            {available.length} {available.length === 1 ? 'work' : 'works'}
          </span>
          <span className="text-xl text-ink">{formatPrice(total, currency)}</span>
        </div>
        <p className="mt-2 font-serif text-xs text-ink/45">
          Shipping and delivery are arranged with the gallery after purchase.
        </p>
        <button
          type="button"
          disabled={available.length === 0 || checkingOut}
          onClick={checkout}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-editorial-ink px-4 py-3 font-jetbrains text-[11px] uppercase tracking-[0.14em] text-bone hover:bg-vermillion disabled:opacity-50 transition-colors"
        >
          {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
          Checkout
        </button>
        <p className="mt-3 text-center font-serif text-[11px] text-ink/45">
          Pay with Apple Pay, Google Pay or card on Stripe’s secure checkout.
        </p>
        {unavailable.length > 0 && (
          <button
            type="button"
            onClick={() => void cart.remove(unavailable.map((u) => u.artworkId))}
            className="mt-4 w-full font-serif text-xs text-ink/50 hover:text-wine"
          >
            Remove unavailable works
          </button>
        )}
      </aside>
    </div>
  );
}
