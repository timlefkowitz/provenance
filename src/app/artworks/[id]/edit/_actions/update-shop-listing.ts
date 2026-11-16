'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { getConnectAccount } from '~/lib/stripe-connect';
import { getStripeClient } from '~/lib/payouts/seller-payouts';

type Result = { ok: true } | { ok: false; error: string };

/**
 * List or unlist a work in the owner's shop and set its price. Creates a new
 * Stripe Price when the price changes (Stripe prices are immutable), reusing
 * the work's Stripe Product when it has one.
 */
export async function updateShopListing(input: {
  artworkId: string;
  forSale: boolean;
  priceUsd: number | null;
}): Promise<Result> {
  console.log('[ArtworkSale] updateShopListing started', { artworkId: input.artworkId, forSale: input.forSale });
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: artwork } = await admin
    .from('artworks')
    .select('id, account_id, title, image_url, sale_price, stripe_product_id, stripe_price_id, sold_at')
    .eq('id', input.artworkId)
    .maybeSingle();
  if (!artwork || artwork.account_id !== user.id) return { ok: false, error: 'Only the owner can list this work.' };
  if (artwork.sold_at && input.forSale) return { ok: false, error: 'This work is already sold.' };

  if (!input.forSale) {
    const { error } = await admin.from('artworks').update({ for_sale: false }).eq('id', artwork.id);
    if (error) return { ok: false, error: 'Could not update the listing.' };
    revalidatePath(`/artworks/${artwork.id}`);
    return { ok: true };
  }

  if (!(await getConnectAccount(user.id))) {
    return { ok: false, error: 'Open your shop in Settings first.' };
  }

  const amountCents = Math.round((input.priceUsd ?? 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return { ok: false, error: 'Enter a price of at least $1.' };
  }

  const priceChanged =
    !artwork.stripe_price_id || Math.round(Number(artwork.sale_price ?? 0) * 100) !== amountCents;

  let stripeProductId = artwork.stripe_product_id as string | null;
  let stripePriceId = artwork.stripe_price_id as string | null;

  if (priceChanged) {
    const stripe = getStripeClient();
    if (!stripe) return { ok: false, error: 'Payments are not configured.' };
    try {
      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: artwork.title as string,
          images: artwork.image_url ? [artwork.image_url as string] : [],
          metadata: { artwork_id: artwork.id as string, seller_user_id: user.id },
        });
        stripeProductId = product.id;
      }
      const price = await stripe.prices.create({ product: stripeProductId, unit_amount: amountCents, currency: 'usd' });
      stripePriceId = price.id;
    } catch (err) {
      console.error('[ArtworkSale] updateShopListing Stripe price failed', err);
      return { ok: false, error: 'Could not set the price. Please try again.' };
    }
  }

  const { error } = await admin
    .from('artworks')
    .update({
      for_sale: true,
      sale_price: amountCents / 100,
      sale_currency: 'usd',
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    })
    .eq('id', artwork.id);
  if (error) {
    console.error('[ArtworkSale] updateShopListing save failed', error);
    return { ok: false, error: 'Could not update the listing.' };
  }

  revalidatePath(`/artworks/${artwork.id}`);
  return { ok: true };
}
