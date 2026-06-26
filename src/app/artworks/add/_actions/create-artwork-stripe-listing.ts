'use server';

import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getActiveSubscription } from '~/lib/subscription';
import { getConnectAccount } from '~/lib/stripe-connect';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

type Input = {
  artworkId: string;
  title: string;
  imageUrl: string | null;
  priceUsd: number;
  ownerUserId: string;
};

type Result =
  | { ok: true; stripeProductId: string; stripePriceId: string }
  | { ok: false; error: string };

/**
 * Creates a Stripe Product + one-time Price for an artwork and persists the
 * IDs to the artworks row.  Only runs when the seller has an active plan AND
 * a connected Stripe account with charges_enabled.
 */
export async function createArtworkStripeListing(input: Input): Promise<Result> {
  console.log('[ArtworkSale] createArtworkStripeListing started', {
    artworkId: input.artworkId,
    ownerUserId: input.ownerUserId,
  });

  try {
    const sub = await getActiveSubscription(input.ownerUserId);
    if (!sub) {
      return { ok: false, error: 'Active subscription required to list artworks for sale.' };
    }

    const connect = await getConnectAccount(input.ownerUserId);
    if (!connect?.charges_enabled) {
      return {
        ok: false,
        error: 'Stripe Connect account with charges enabled is required to list artworks for sale.',
      };
    }

    const stripe = getStripe();
    if (!stripe) {
      return { ok: false, error: 'Billing not configured.' };
    }

    const amountCents = Math.round(input.priceUsd * 100);
    if (amountCents < 50) {
      return { ok: false, error: 'Price must be at least $0.50.' };
    }

    console.log('[ArtworkSale] Creating Stripe product for artwork', {
      artworkId: input.artworkId,
    });

    const images = input.imageUrl ? [input.imageUrl] : [];
    const product = await stripe.products.create({
      name: input.title,
      images,
      metadata: { artwork_id: input.artworkId, seller_user_id: input.ownerUserId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: 'usd',
    });

    const admin = getSupabaseServerAdminClient();
    const { error: updateErr } = await (admin as any)
      .from('artworks')
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      })
      .eq('id', input.artworkId);

    if (updateErr) {
      console.error('[ArtworkSale] Failed to persist Stripe IDs', updateErr);
      return { ok: false, error: 'Stripe product created but could not save to database.' };
    }

    console.log('[ArtworkSale] Stripe product created for artwork', {
      artworkId: input.artworkId,
      productId: product.id,
      priceId: price.id,
    });

    return { ok: true, stripeProductId: product.id, stripePriceId: price.id };
  } catch (err) {
    console.error('[ArtworkSale] createArtworkStripeListing failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create Stripe listing.',
    };
  }
}
