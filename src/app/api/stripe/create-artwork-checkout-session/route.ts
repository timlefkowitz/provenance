import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getActiveSubscription } from '~/lib/subscription';
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
    const { data: artwork, error: artworkErr } = await (admin as any)
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

    // Verify seller has active paid plan and charges enabled Connect account
    const [ownerSub, connectAccount] = await Promise.all([
      getActiveSubscription(artwork.account_id),
      getConnectAccount(artwork.account_id),
    ]);

    if (!ownerSub) {
      return NextResponse.json(
        { error: 'This artwork is no longer available for purchase' },
        { status: 400 },
      );
    }
    if (!connectAccount?.charges_enabled) {
      return NextResponse.json(
        { error: 'This artwork is no longer available for purchase' },
        { status: 400 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const successUrl = `${siteUrl}?artwork_purchased=1`;
    const cancelUrl = req.headers.get('referer') || siteUrl;

    // Platform fee (optional — defaults to 0 if env var not set)
    const feePct = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '0');
    const salePriceCents = artwork.sale_price ? Math.round(Number(artwork.sale_price) * 100) : null;
    const applicationFeeAmount =
      feePct > 0 && salePriceCents
        ? Math.round(salePriceCents * (feePct / 100))
        : undefined;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [{ price: artwork.stripe_price_id, quantity: 1 }],
      payment_intent_data: {
        transfer_data: {
          destination: connectAccount.stripe_account_id,
        },
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'artwork_purchase',
        artwork_id: artworkId,
        owner_account_id: artwork.account_id,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

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
