import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveCartItems } from '~/lib/cart/resolve-cart';
import { getStripeClient } from '~/lib/payouts/seller-payouts';
import { asUntyped } from '~/lib/supabase-untyped';

const CHECKOUT_HOLD_MINUTES = 30;

const BodySchema = z.object({
  items: z
    .array(z.object({ artworkId: z.string().uuid(), exhibitionId: z.string().uuid() }))
    .min(1)
    .max(25),
});

/**
 * Start one Stripe Checkout for a whole cart of exhibition works. Apple Pay,
 * Google Pay and cards show up on Stripe's page automatically. Every work is
 * held for the length of the session, all or nothing.
 */
export async function POST(req: NextRequest) {
  console.log('[Cart] create-cart-checkout-session started');
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Your cart is empty or invalid.' }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  const admin = asUntyped(getSupabaseServerAdminClient());

  const resolved = await resolveCartItems(admin, parsed.data.items);
  const unavailable = resolved.filter((r) => !r.available);
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: 'Some works in your cart are no longer available.',
        unavailable: unavailable.map((u) => ({ artworkId: u.artworkId, reason: u.reason })),
      },
      { status: 409 },
    );
  }
  const items = resolved.filter((r) => r.available);
  const currencies = new Set(items.map((i) => i.currency));
  if (currencies.size > 1) {
    return NextResponse.json(
      { error: 'Works priced in different currencies need separate checkouts.' },
      { status: 400 },
    );
  }
  const currency = [...currencies][0] ?? 'usd';

  // Hold every certificate behind every work, or none.
  const holdIds = [...new Set(items.flatMap((i) => i.relatedArtworkIds))];
  const expiresAtSec = Math.floor(Date.now() / 1000) + CHECKOUT_HOLD_MINUTES * 60;
  const { data: busy, error: holdErr } = await admin.rpc('reserve_artworks_for_checkout', {
    p_artwork_ids: holdIds,
    p_until: new Date(expiresAtSec * 1000).toISOString(),
  });
  if (holdErr) {
    console.error('[Cart] failed to hold works', holdErr);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
  const busyIds = new Set((busy as string[] | null) ?? []);
  if (busyIds.size > 0) {
    const conflicts = items.filter((i) => i.relatedArtworkIds.some((id) => busyIds.has(id)));
    return NextResponse.json(
      {
        error: 'Someone else is checking out a work in your cart right now. Try again in a few minutes.',
        unavailable: conflicts.map((c) => ({ artworkId: c.artworkId, reason: 'held' })),
      },
      { status: 409 },
    );
  }

  const releaseHolds = () =>
    admin.from('artworks').update({ checkout_reserved_until: null }).in('id', holdIds).is('sold_at', null);

  let orderId: string | null = null;
  try {
    const total = items.reduce((a, i) => a + i.priceCents, 0);
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        buyer_account_id: user?.id ?? null,
        buyer_email: user?.email ?? null,
        status: 'pending',
        amount_total_cents: total,
        currency,
      })
      .select('id')
      .single();
    if (orderErr || !order) throw orderErr ?? new Error('order insert failed');
    orderId = order.id as string;

    const { error: itemsErr } = await admin.from('order_items').insert(
      items.map((i) => ({
        order_id: orderId,
        artwork_id: i.artworkId,
        artwork_title: i.title,
        exhibition_id: i.exhibitionId,
        price_cents: i.priceCents,
        currency,
        artist_account_id: i.artistAccountId,
        gallery_account_id: i.galleryAccountId,
        commission_percent: i.commissionPercent,
      })),
    );
    if (itemsErr) throw itemsErr;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: items.map((i) => ({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: i.priceCents,
          product_data: {
            name: i.title,
            ...(i.artistName ? { description: `${i.artistName} · ${i.exhibitionTitle}` } : {}),
            ...(i.imageUrl?.startsWith('https://') ? { images: [i.imageUrl] } : {}),
            metadata: { artwork_id: i.artworkId, exhibition_id: i.exhibitionId },
          },
        },
      })),
      expires_at: expiresAtSec,
      ...(user?.email ? { customer_email: user.email } : {}),
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'MX'] },
      phone_number_collection: { enabled: true },
      payment_intent_data: {
        transfer_group: `order:${orderId}`,
        metadata: { order_id: orderId },
      },
      success_url: `${siteUrl}/cart/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      metadata: { type: 'cart_purchase', order_id: orderId, buyer_account_id: user?.id ?? '' },
    };

    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `cart-order-${orderId}`,
    });
    await admin.from('orders').update({ checkout_session_id: session.id }).eq('id', orderId);

    if (!session.url) throw new Error('Checkout session has no url');
    console.log('[Cart] checkout session created', { orderId, sessionId: session.id, works: items.length });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[Cart] create-cart-checkout-session failed', { orderId, err });
    await releaseHolds();
    if (orderId) await admin.from('orders').update({ status: 'expired' }).eq('id', orderId);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
