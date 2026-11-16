'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Button } from '@kit/ui/button';
import { Loader2 } from 'lucide-react';
import { estimateStripeFeeCents, splitEarning } from '~/lib/payouts/earnings-math';
import { updateShopListing } from '../_actions/update-shop-listing';

type Props = {
  artworkId: string;
  shopOpen: boolean;
  sold: boolean;
  initialForSale: boolean;
  initialPrice: number | null;
  feePercent: number;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function ShopListingCard({ artworkId, shopOpen, sold, initialForSale, initialPrice, feePercent }: Props) {
  const [forSale, setForSale] = useState(initialForSale);
  const [price, setPrice] = useState(initialPrice ? String(initialPrice) : '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const cents = Math.round(Number(price || 0) * 100);
  const preview = cents >= 100 ? splitEarning(cents, estimateStripeFeeCents(cents), feePercent) : null;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateShopListing({ artworkId, forSale, priceUsd: forSale ? Number(price) : null });
      setMessage(res.ok ? { ok: true, text: forSale ? 'Listed in your shop.' : 'Removed from your shop.' } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="mb-8 rounded-lg border border-wine/20 bg-parchment/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="shop-for-sale" className="font-serif text-base">Sell in your shop</Label>
          <p className="text-ink/60 font-serif text-xs">Shows a Buy button with card checkout on your site.</p>
        </div>
        {shopOpen && !sold && <Switch id="shop-for-sale" checked={forSale} onCheckedChange={setForSale} />}
      </div>

      {sold ? (
        <p className="text-sm text-ink/60 font-serif">This work is sold.</p>
      ) : !shopOpen ? (
        <p className="text-sm font-serif text-ink/80">
          <Link href="/settings#shop" className="text-wine underline">Open your shop</Link> in Settings to sell
          this work. It takes one click, and you don&rsquo;t need a plan.
        </p>
      ) : (
        <>
          {forSale && (
            <div className="space-y-1">
              <Label htmlFor="shop-price" className="font-serif text-sm">Price (USD)</Label>
              <div className="relative max-w-xs">
                <span className="text-ink/50 absolute top-1/2 left-3 -translate-y-1/2 font-serif text-sm">$</span>
                <Input
                  id="shop-price"
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7 font-serif"
                />
              </div>
              {preview && (
                <p className="text-ink/50 font-serif text-xs">
                  You get about {money(preview.netCents)} after our {feePercent}% fee and card processing.
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save listing
            </Button>
            {message && (
              <span className={`text-sm font-serif ${message.ok ? 'text-green-700' : 'text-red-600'}`}>
                {message.text}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
