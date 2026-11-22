import 'server-only';

import Stripe from 'stripe';

import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { sendNotificationEmail } from '~/lib/email';
import { loadExhibitionListings } from '~/lib/exhibition-sales/load-listings';
import { recordEarningsForOrder } from '~/lib/payouts/seller-payouts';
import { recordSale } from '~/lib/sales/record-sale';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

type OrderItemRow = {
  id: string;
  artwork_id: string | null;
  artwork_title: string | null;
  exhibition_id: string | null;
  price_cents: number;
  artist_account_id: string;
  gallery_account_id: string | null;
  commission_percent: number | string;
};

async function loadOrder(admin: UntypedSupabaseClient, orderId: string) {
  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_account_id, checkout_session_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  const { data: items } = await admin
    .from('order_items')
    .select('id, artwork_id, artwork_title, exhibition_id, price_cents, artist_account_id, gallery_account_id, commission_percent')
    .eq('order_id', orderId);
  return { order, items: (items ?? []) as OrderItemRow[] };
}

/** The certificate the sale is recorded on, and every certificate held with it. */
async function saleTargets(
  admin: UntypedSupabaseClient,
  item: OrderItemRow,
): Promise<{ saleArtworkId: string; holdIds: string[] }> {
  const shownId = item.artwork_id!;
  if (!item.exhibition_id) return { saleArtworkId: shownId, holdIds: [shownId] };
  const data = await loadExhibitionListings(admin, item.exhibition_id);
  const listing = data?.listings.get(shownId);
  return listing
    ? { saleArtworkId: listing.saleArtworkId, holdIds: listing.relatedArtworkIds }
    : { saleArtworkId: shownId, holdIds: [shownId] };
}

/**
 * A cart Checkout Session was paid. Books earnings first (so a failure makes
 * Stripe retry before anything else is written), then records each sale,
 * clears holds and empties the buyer's cart. Safe to run more than once.
 */
export async function fulfillCartOrder(
  stripe: Stripe,
  admin: UntypedSupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const orderId = session.metadata?.order_id;
  if (!orderId) return { ok: false, error: 'missing order_id' };
  if (session.payment_status !== 'paid') {
    console.log('[Cart] session completed but not paid yet', { orderId, status: session.payment_status });
    return { ok: true };
  }

  const loaded = await loadOrder(admin, orderId);
  if (!loaded) return { ok: false, error: 'order not found' };
  const { order, items } = loaded;
  if (order.status === 'paid') return { ok: true, duplicate: true };

  const buyerEmail = session.customer_details?.email ?? null;
  const buyerName = session.customer_details?.name ?? null;

  // 1. Earnings (idempotent per session/work/payee). Throws → webhook 500 → retry.
  await recordEarningsForOrder({
    stripe,
    admin,
    session,
    items: items
      .filter((i) => i.artwork_id)
      .map((i) => ({
        orderItemId: i.id,
        artworkId: i.artwork_id!,
        priceCents: i.price_cents,
        artistAccountId: i.artist_account_id,
        galleryAccountId: i.gallery_account_id,
        commissionPercent: Number(i.commission_percent) || 0,
        title: i.artwork_title,
      })),
  });

  // 2. Each sale: sold columns, ledger, provenance, red dot, artist told.
  for (const item of items) {
    if (!item.artwork_id) continue;
    try {
      const { saleArtworkId, holdIds } = await saleTargets(admin, item);
      const sale = await recordSale(admin, {
        artworkId: saleArtworkId,
        buyer: { accountId: order.buyer_account_id ?? null, email: buyerEmail, name: buyerName },
        priceCents: item.price_cents,
        currency: session.currency ?? 'usd',
        recordedBy: null,
        metadata: {
          source: 'cart_checkout',
          stripe_session_id: session.id,
          order_id: orderId,
          ...(item.exhibition_id ? { exhibition_id: item.exhibition_id } : {}),
        },
      });
      if (!sale.success) console.error('[Cart] recordSale failed', { orderId, saleArtworkId, error: sale.error });

      await admin.from('artworks').update({ checkout_reserved_until: null }).in('id', holdIds);

      await admin.from('artwork_inquiries').insert({
        artwork_id: item.artwork_id,
        owner_account_id: item.gallery_account_id ?? item.artist_account_id,
        name: buyerName ?? buyerEmail ?? 'Unknown buyer',
        email: buyerEmail ?? '',
        inquiry_type: 'purchase',
        stripe_session_id: session.id,
        status: 'sold',
      });

      if (buyerEmail) {
        const payees = [...new Set([item.artist_account_id, item.gallery_account_id].filter(Boolean))] as string[];
        for (const payee of payees) {
          await captureCrmContacts(
            payee,
            [{ email: buyerEmail, name: buyerName ?? undefined, source: 'artwork_purchase', artworkId: item.artwork_id }],
            { client: admin },
          ).catch((e: unknown) => console.error('[Cart] CRM capture failed (non-fatal)', e));
        }
      }
    } catch (err) {
      console.error('[Cart] fulfilling order item failed', { orderId, itemId: item.id, err });
    }
  }

  // 3. Order paid; the bought works leave the buyer's cart.
  await admin
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: session.customer_details?.phone ?? null,
      shipping_details:
        (session as unknown as { collected_information?: { shipping_details?: unknown } }).collected_information
          ?.shipping_details ??
        (session as unknown as { shipping_details?: unknown }).shipping_details ??
        null,
      amount_total_cents: session.amount_total ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (order.buyer_account_id) {
    await admin
      .from('cart_items')
      .delete()
      .eq('account_id', order.buyer_account_id)
      .in('artwork_id', items.map((i) => i.artwork_id).filter(Boolean));
  }

  await emailShipTo(admin, session, items).catch((e: unknown) =>
    console.error('[Cart] ship-to email failed (non-fatal)', e),
  );

  console.log('[Cart] order fulfilled', { orderId, sessionId: session.id, works: items.length });
  return { ok: true };
}

/** A cart Checkout Session expired unpaid: let the works go. */
export async function expireCartOrder(admin: UntypedSupabaseClient, session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const loaded = await loadOrder(admin, orderId);
  if (!loaded || loaded.order.status !== 'pending') return;
  for (const item of loaded.items) {
    if (!item.artwork_id) continue;
    const { holdIds } = await saleTargets(admin, item);
    await admin.from('artworks').update({ checkout_reserved_until: null }).in('id', holdIds).is('sold_at', null);
  }
  await admin
    .from('orders')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'pending');
  console.log('[Cart] order expired', { orderId });
}

type Address = { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null };

function formatShipping(session: Stripe.Checkout.Session): string {
  const raw =
    (session as unknown as { collected_information?: { shipping_details?: { name?: string; address?: Address } } })
      .collected_information?.shipping_details ??
    (session as unknown as { shipping_details?: { name?: string; address?: Address } }).shipping_details;
  if (!raw?.address) return 'No shipping address given.';
  const a = raw.address;
  return [raw.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(' '), a.country]
    .filter(Boolean)
    .join('\n');
}

/** Tell whoever handles each work (the show's gallery, else the artist) who bought it and where it goes. */
async function emailShipTo(
  admin: UntypedSupabaseClient,
  session: Stripe.Checkout.Session,
  items: OrderItemRow[],
): Promise<void> {
  const byHandler = new Map<string, string[]>();
  for (const i of items) {
    const handler = i.gallery_account_id ?? i.artist_account_id;
    byHandler.set(handler, [...(byHandler.get(handler) ?? []), i.artwork_title ?? 'Untitled']);
  }
  const buyer = session.customer_details;
  const contact = [buyer?.name, buyer?.email, buyer?.phone].filter(Boolean).join(' · ');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  for (const [accountId, titles] of byHandler) {
    const { data: account } = await admin.from('accounts').select('email, name').eq('id', accountId).maybeSingle();
    if (!account?.email) continue;
    const list = titles.join(', ');
    await sendNotificationEmail(account.email as string, (account.name as string) || '', `Sold online: ${list}`, {
      title: `Sold online: ${list}`,
      body: `The buyer paid through Provenance. Please arrange delivery.\n\nBuyer: ${contact || 'not given'}\n\nShip to:\n${formatShipping(session)}`,
      ctaUrl: `${siteUrl}/settings#shop`,
      ctaLabel: 'View sales',
    });
  }
}
