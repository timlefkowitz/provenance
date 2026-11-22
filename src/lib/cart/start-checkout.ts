import 'server-only';

import Stripe from 'stripe';

import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import type { ResolvedCartItem } from './resolve-cart';

const CHECKOUT_HOLD_MINUTES = 30;

export type StartCheckoutResult =
  | { ok: true; url: string; orderId: string }
  | {
      ok: false;
      status: number;
      error: string;
      unavailable?: Array<{ artworkId: string; reason: string }>;
      signIn?: boolean;
    };

/**
 * One Stripe Checkout for a set of resolved works (a cart or an invoice).
 * Apple Pay, Google Pay and cards appear on Stripe's page automatically.
 * Every work is held for the length of the session, all or nothing; the
 * order and its split are saved before Stripe is called.
 */
export async function startCheckout(
  admin: UntypedSupabaseClient,
  stripe: Stripe,
  params: {
    items: ResolvedCartItem[];
    user: { id: string; email?: string | null } | null;
    app?: boolean;
    invoiceId?: string | null;
    /** Where Stripe's back button goes. */
    cancelPath: string;
  },
): Promise<StartCheckoutResult> {
  const { items, user } = params;
  if (items.length === 0) return { ok: false, status: 400, error: 'Nothing to pay for.' };

  // A collector's resale passes their Certificate of Ownership to the buyer's account.
  if (!user && items.some((i) => i.requiresAccount)) {
    return {
      ok: false,
      status: 401,
      error: 'Sign in to buy this work: its Certificate of Ownership is transferred to your account.',
      signIn: true,
    };
  }
  const currencies = new Set(items.map((i) => i.currency));
  if (currencies.size > 1) {
    return { ok: false, status: 400, error: 'Works priced in different currencies need separate checkouts.' };
  }
  const currency = [...currencies][0] ?? 'usd';

  const holdIds = [...new Set(items.flatMap((i) => i.relatedArtworkIds))];
  const expiresAtSec = Math.floor(Date.now() / 1000) + CHECKOUT_HOLD_MINUTES * 60;
  const { data: busy, error: holdErr } = await admin.rpc('reserve_artworks_for_checkout', {
    p_artwork_ids: holdIds,
    p_until: new Date(expiresAtSec * 1000).toISOString(),
  });
  if (holdErr) {
    console.error('[Checkout] failed to hold works', holdErr);
    return { ok: false, status: 500, error: 'Could not start checkout. Please try again.' };
  }
  const busyIds = new Set((busy as string[] | null) ?? []);
  if (busyIds.size > 0) {
    const conflicts = items.filter((i) => i.relatedArtworkIds.some((id) => busyIds.has(id)));
    return {
      ok: false,
      status: 409,
      error: 'Someone else is checking out one of these works right now. Try again in a few minutes.',
      unavailable: conflicts.map((c) => ({ artworkId: c.artworkId, reason: 'held' })),
    };
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
        sale_invoice_id: params.invoiceId ?? null,
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
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: items.map((i) => ({
          quantity: 1,
          price_data: {
            currency,
            unit_amount: i.priceCents,
            product_data: {
              name: i.title,
              ...(i.artistName
                ? { description: [i.artistName, i.exhibitionTitle].filter(Boolean).join(' · ') }
                : {}),
              ...(i.imageUrl?.startsWith('https://') ? { images: [i.imageUrl] } : {}),
              metadata: { artwork_id: i.artworkId, exhibition_id: i.exhibitionId ?? '' },
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
        success_url: `${siteUrl}/cart/success?session_id={CHECKOUT_SESSION_ID}${params.app ? '&app=1' : ''}`,
        cancel_url: `${siteUrl}${params.cancelPath}`,
        metadata: {
          type: 'cart_purchase',
          order_id: orderId,
          buyer_account_id: user?.id ?? '',
          ...(params.invoiceId ? { invoice_id: params.invoiceId } : {}),
        },
      },
      { idempotencyKey: `cart-order-${orderId}` },
    );
    await admin.from('orders').update({ checkout_session_id: session.id }).eq('id', orderId);
    if (!session.url) throw new Error('Checkout session has no url');
    console.log('[Checkout] session created', {
      orderId,
      sessionId: session.id,
      works: items.length,
      invoiceId: params.invoiceId ?? null,
    });
    return { ok: true, url: session.url, orderId };
  } catch (err) {
    console.error('[Checkout] start failed', { orderId, err });
    await releaseHolds();
    if (orderId) await admin.from('orders').update({ status: 'expired' }).eq('id', orderId);
    return { ok: false, status: 500, error: 'Could not start checkout. Please try again.' };
  }
}
