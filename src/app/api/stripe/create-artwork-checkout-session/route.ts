import { asUntyped } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getConnectAccount } from '~/lib/stripe-connect';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  console.log('[ArtworkSale] create-artwork-checkout-session started');
  try {
    const body = await req.json().catch(() => ({}));
    const artworkId = body?.artworkId as string | undefined;

    if (!artworkId) {
      return NextResponse.json({ error: 'artworkId is required' }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const admin = getSupabaseServerAdminClient();

    // Fetch artwork
    const { data: artwork, error: artworkErr } = await asUntyped(admin)
      .from('artworks')
      .select('id, account_id, title, for_sale, stripe_price_id, sold_at, sale_price, sale_currency')
      .eq('id', artworkId)
      .eq('status', 'verified')
      .eq('is_public', true)
      .maybeSingle();

    if (artworkErr || !artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });
    }
    if (!artwork.for_sale || !artwork.stripe_price_id) {
      return NextResponse.json({ error: 'Artwork is not listed for sale' }, { status: 400 });
    }
    if (artwork.sold_at) {
      return NextResponse.json({ error: 'This artwork has already been sold' }, { status: 400 });
    }

    // The seller must have opened a shop. No plan or finished payout setup is
    // needed: the buyer pays Provenance and we pay the seller out later.
    const connectAccount = await getConnectAccount(artwork.account_id);
    if (!connectAccount) {
      return NextResponse.json(
        { error: 'This artwork is no longer available for purchase' },
        { status: 400 },
      );
    }

    // Hold the work while this buyer is in Checkout so nobody else can pay for it.
    const now = new Date();
    const expiresAtSec = Math.floor(now.getTime() / 1000) + 30 * 60;
    const { data: reserved, error: reserveErr } = await asUntyped(admin)
      .from('artworks')
      .update({ checkout_reserved_until: new Date(expiresAtSec * 1000).toISOString() })
      .eq('id', artworkId)
      .is('sold_at', null)
      .or(`checkout_reserved_until.is.null,checkout_reserved_until.lt.${now.toISOString()}`)
      .select('id');
    if (reserveErr) {
      console.error('[ArtworkSale] failed to reserve artwork', reserveErr);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
    if (!reserved || reserved.length === 0) {
      return NextResponse.json(
        { error: 'Someone is checking out this work right now. Please try again in a few minutes.' },
        { status: 409 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const successUrl = `${siteUrl}?artwork_purchased=1`;
    const cancelUrl = req.headers.get('referer') || siteUrl;

    // Separate charges and transfers: the charge stays on Provenance's account;
    // the seller's share is recorded on payment and transferred by the
    // pay-sellers cron.
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [{ price: artwork.stripe_price_id, quantity: 1 }],
      expires_at: expiresAtSec,
      payment_intent_data: {
        transfer_group: `artwork:${artworkId}`,
        metadata: { artwork_id: artworkId, seller_account_id: artwork.account_id },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'artwork_purchase',
        artwork_id: artworkId,
        owner_account_id: artwork.account_id,
        seller_account_id: artwork.account_id,
        payout_model: 'platform',
      },
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (createErr) {
      await asUntyped(admin).from('artworks').update({ checkout_reserved_until: null }).eq('id', artworkId);
      throw createErr;
    }

    if (!session.url) {
      console.error('[ArtworkSale] Checkout session created but no url', session.id);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }

    console.log('[ArtworkSale] Checkout session created', {
      artworkId,
      sessionId: session.id,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[ArtworkSale] create-artwork-checkout-session failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
