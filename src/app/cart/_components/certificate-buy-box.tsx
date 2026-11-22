'use client';

import Link from 'next/link';

import { formatPrice } from '~/lib/cart/format';

import { AddToCartButton } from './add-to-cart-button';
import { BuyNowButton } from './buy-now-button';

/** Price, Buy now and Add to cart on a certificate whose work is for sale. */
export function CertificateBuyBox({
  artworkId,
  exhibitionId,
  exhibitionTitle,
  priceCents,
  currency,
  held,
  signInHref,
  preview,
}: {
  artworkId: string;
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  priceCents: number;
  currency: string;
  held: boolean;
  /** Set when buying needs an account (a collector's resale) and the visitor is signed out. */
  signInHref?: string | null;
  /** The holder or the show's managers: show what visitors see, without buttons. */
  preview?: boolean;
}) {
  return (
    <div className="container mx-auto max-w-5xl px-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-wine/15 bg-parchment/60 px-5 py-4">
        <div>
          <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">
            {preview ? 'For sale online' : 'For sale'}
          </p>
          <p className="font-display text-2xl text-ink">{formatPrice(priceCents, currency)}</p>
          {exhibitionId && exhibitionTitle && (
            <p className="font-serif text-xs text-ink/50">
              Through{' '}
              <Link href={`/exhibitions/${exhibitionId}`} className="underline-offset-2 hover:text-wine hover:underline">
                {exhibitionTitle}
              </Link>
            </p>
          )}
        </div>
        {preview ? (
          <p className="max-w-xs font-serif text-sm text-ink/55">
            Visitors see Buy now and Add to cart here.
            {exhibitionId ? ' Change the price in the show’s Online sales settings.' : ''}
          </p>
        ) : held ? (
          <p className="font-serif text-sm text-ink/55">Someone is checking out this work right now.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton artworkId={artworkId} exhibitionId={exhibitionId} />
            {signInHref ? (
              <Link
                href={signInHref}
                className="inline-flex items-center gap-2 rounded-md bg-editorial-ink px-5 py-2 font-jetbrains text-[11px] uppercase tracking-[0.14em] text-bone transition-colors hover:bg-vermillion"
              >
                Sign in to buy
              </Link>
            ) : (
              <BuyNowButton artworkId={artworkId} exhibitionId={exhibitionId} />
            )}
          </div>
        )}
      </div>
      {!preview && (
        <p className="mt-2 text-right font-serif text-[11px] text-ink/45">
          {signInHref
            ? 'This collector’s Certificate of Ownership passes to your account, so sign in first.'
            : 'Apple Pay, Google Pay or card. You receive the work’s Certificate of Ownership.'}
        </p>
      )}
    </div>
  );
}
