import 'server-only';

import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { notifyAdmins } from '~/lib/admin-notify';
import { sendNotificationEmail } from '~/lib/email';
import {
  isDueForTransfer,
  payoutHoldDays,
  platformFeePercent,
  releaseAt,
  splitEarning,
  splitOrder,
  statusAfterRefundOrDispute,
  type OrderItemForSplit,
  type EarningStatus,
} from './earnings-math';

/**
 * Seller payouts.
 *
 * Buyers pay Provenance's own Stripe account (separate charges and transfers).
 * Each paid sale becomes a `seller_earnings` row. Once the hold has passed and
 * the seller has given payout details, the cron transfers their net to a
 * platform-controlled connected account (no Stripe dashboard or login for the
 * seller), and Stripe pays it out to their bank.
 */

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export type SellerEarningRow = {
  id: string;
  seller_account_id: string;
  artwork_id: string | null;
  artwork_title: string | null;
  checkout_session_id: string;
  charge_id: string | null;
  gross_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  net_cents: number;
  currency: string;
  status: EarningStatus;
  release_at: string;
  transfer_id: string | null;
  transferred_at: string | null;
  created_at: string;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connected accounts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make sure the seller has a connected account we can transfer to. Created
 * silently: no Stripe dashboard, Provenance pays Stripe's fees and Stripe
 * carries negative-balance losses. Payout details are collected later in our own settings page via the
 * embedded onboarding component. Legacy Express accounts are reused as-is.
 */
export async function ensurePayoutAccount(
  userId: string,
  email: string | null,
): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  const stripe = getStripeClient();
  if (!stripe) return { ok: false, error: 'Payments are not configured.' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: existing } = await admin
    .from('stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.stripe_account_id) {
    return { ok: true, accountId: existing.stripe_account_id as string };
  }

  console.log('[Payouts] creating platform payout account', { userId });
  const account = await stripe.accounts.create(
    {
      country: 'US',
      business_type: 'individual',
      email: email ?? undefined,
      controller: {
        stripe_dashboard: { type: 'none' },
        fees: { payer: 'application' },
        // Stripe must carry losses when it collects requirements on an account
        // with no dashboard; 'application' is rejected for this combination.
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      capabilities: { transfers: { requested: true } },
      settings: { payouts: { schedule: { interval: 'daily' } } },
      metadata: { user_id: userId },
    },
    { idempotencyKey: `payout-account-v2-${userId}` },
  );

  const { error } = await admin.from('stripe_connect_accounts').insert({
    user_id: userId,
    stripe_account_id: account.id,
    account_kind: 'platform',
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
    payouts_enabled: account.payouts_enabled,
  });
  if (error) {
    // A concurrent call may have inserted first; the idempotency key means it's the same account.
    console.error('[Payouts] failed to persist payout account', { userId, accountId: account.id, error });
    const { data: raced } = await admin
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (raced?.stripe_account_id) return { ok: true, accountId: raced.stripe_account_id as string };
    return { ok: false, error: 'Could not save payout account.' };
  }
  return { ok: true, accountId: account.id };
}

/** Mirror a Stripe account's status flags into our table (from account.updated). */
export async function syncConnectAccount(account: Stripe.Account): Promise<string | null> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data, error } = await admin
    .from('stripe_connect_accounts')
    .update({
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id)
    .select('user_id')
    .maybeSingle();
  if (error) {
    console.error('[Payouts] syncConnectAccount failed', { accountId: account.id, error });
    return null;
  }
  return (data?.user_id as string | undefined) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recording earnings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn a completed artwork Checkout Session into a seller_earnings row.
 * Idempotent on checkout_session_id (webhooks retry).
 */
export async function recordEarningFromCheckout(params: {
  stripe: Stripe;
  admin: UntypedSupabaseClient;
  session: Stripe.Checkout.Session;
  sellerAccountId: string;
  artworkId: string;
}): Promise<void> {
  const { stripe, admin, session, sellerAccountId, artworkId } = params;
  const gross = typeof session.amount_total === 'number' ? session.amount_total : 0;
  const currency = (session.currency ?? 'usd').toLowerCase();

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

  let chargeId: string | null = null;
  let stripeFee = 0;
  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    chargeId = charge?.id ?? null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    stripeFee = bt?.fee ?? 0;
  }

  const split = splitEarning(gross, stripeFee, platformFeePercent());

  const { data: artwork } = await admin.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (artwork?.title as string | undefined) ?? 'your artwork';

  const { error } = await admin.from('seller_earnings').upsert(
    {
      seller_account_id: sellerAccountId,
      artwork_id: artworkId,
      artwork_title: title,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      gross_cents: split.grossCents,
      platform_fee_cents: split.platformFeeCents,
      stripe_fee_cents: split.stripeFeeCents,
      net_cents: split.netCents,
      currency,
      status: 'pending',
      release_at: releaseAt(new Date(), payoutHoldDays()).toISOString(),
    },
    { onConflict: 'checkout_session_id,artwork_id,seller_account_id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('[Payouts] failed to record earning', { sessionId: session.id, error });
    throw new Error('Failed to record seller earning');
  }

  // Clear the checkout hold now that the work is sold.
  await admin.from('artworks').update({ checkout_reserved_until: null }).eq('id', artworkId);

  console.log('[Payouts] earning recorded', { sessionId: session.id, sellerAccountId, net: split.netCents });

  await emailSellerAboutSale(admin, sellerAccountId, title, formatMoney(split.netCents, currency));
}

/**
 * Turn a paid cart Checkout Session into seller_earnings rows: per work, the
 * artist's share and, when the show takes a commission, the gallery's share.
 * Idempotent on (checkout_session_id, artwork_id, seller_account_id).
 */
export async function recordEarningsForOrder(params: {
  stripe: Stripe;
  admin: UntypedSupabaseClient;
  session: Stripe.Checkout.Session;
  items: Array<OrderItemForSplit & { title: string | null }>;
}): Promise<void> {
  const { stripe, admin, session, items } = params;
  if (items.length === 0) return;
  const currency = (session.currency ?? 'usd').toLowerCase();
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

  let chargeId: string | null = null;
  let stripeFee = 0;
  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    chargeId = charge?.id ?? null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    stripeFee = bt?.fee ?? 0;
  }

  const lines = splitOrder(items, stripeFee, platformFeePercent());
  const titles = new Map(items.map((i) => [i.orderItemId, i.title]));
  const release = releaseAt(new Date(), payoutHoldDays()).toISOString();

  const { error } = await admin.from('seller_earnings').upsert(
    lines.map((l) => ({
      seller_account_id: l.sellerAccountId,
      artwork_id: l.artworkId,
      artwork_title: titles.get(l.orderItemId) ?? null,
      order_item_id: l.orderItemId,
      role: l.role,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      gross_cents: l.grossCents,
      platform_fee_cents: l.platformFeeCents,
      stripe_fee_cents: l.stripeFeeCents,
      net_cents: l.netCents,
      currency,
      status: 'pending',
      release_at: release,
    })),
    { onConflict: 'checkout_session_id,artwork_id,seller_account_id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('[Payouts] failed to record order earnings', { sessionId: session.id, error });
    throw new Error('Failed to record seller earnings');
  }

  console.log('[Payouts] order earnings recorded', { sessionId: session.id, lines: lines.length });

  // One email per payee and work.
  for (const l of lines) {
    const title = titles.get(l.orderItemId) ?? 'your artwork';
    const label = l.role === 'gallery_commission' ? `${title} (commission)` : title;
    await emailSellerAboutSale(admin, l.sellerAccountId, label, formatMoney(l.netCents, currency));
  }
}

async function emailSellerAboutSale(
  admin: UntypedSupabaseClient,
  sellerAccountId: string,
  title: string,
  netFormatted: string,
): Promise<void> {
  try {
    const [{ data: account }, { data: connect }] = await Promise.all([
      admin.from('accounts').select('email, name').eq('id', sellerAccountId).maybeSingle(),
      admin.from('stripe_connect_accounts').select('payouts_enabled').eq('user_id', sellerAccountId).maybeSingle(),
    ]);
    if (!account?.email) return;
    const needsDetails = !connect?.payouts_enabled;
    await sendNotificationEmail(account.email as string, (account.name as string) || '', `You sold ${title}`, {
      title: `You sold ${title}`,
      body: needsDetails
        ? `${netFormatted} is waiting for you. Add your payout details so we can send it to your bank.`
        : `${netFormatted} is on its way to your bank. You can follow it in your shop settings.`,
      ctaUrl: `${siteUrl()}/settings#shop`,
      ctaLabel: needsDetails ? 'Add payout details' : 'View earnings',
    });
  } catch (err) {
    console.error('[Payouts] sale email failed (non-fatal)', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfers
// ─────────────────────────────────────────────────────────────────────────────

async function transferEarning(
  stripe: Stripe,
  admin: UntypedSupabaseClient,
  earning: SellerEarningRow,
  destination: string,
): Promise<boolean> {
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: earning.net_cents,
        currency: earning.currency,
        destination,
        ...(earning.charge_id ? { source_transaction: earning.charge_id } : {}),
        transfer_group: earning.artwork_id ? `artwork:${earning.artwork_id}` : undefined,
        metadata: { seller_earning_id: earning.id, seller_account_id: earning.seller_account_id },
      },
      { idempotencyKey: `seller-earning-${earning.id}` },
    );
    await admin
      .from('seller_earnings')
      .update({
        status: 'transferred',
        transfer_id: transfer.id,
        transferred_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', earning.id)
      .eq('status', 'pending');
    console.log('[Payouts] transferred earning', { earningId: earning.id, transferId: transfer.id });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Payouts] transfer failed', { earningId: earning.id, message });
    await admin
      .from('seller_earnings')
      .update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', earning.id);
    return false;
  }
}

/**
 * Transfer every released, pending earning whose seller can be paid. Pass a
 * sellerAccountId to only pay one seller (e.g. right after they finish payout
 * details).
 */
export async function payDueEarnings(opts: { sellerAccountId?: string; limit?: number } = {}): Promise<{
  considered: number;
  transferred: number;
  failed: number;
}> {
  const stripe = getStripeClient();
  if (!stripe) return { considered: 0, transferred: 0, failed: 0 };
  const admin = asUntyped(getSupabaseServerAdminClient());
  const now = new Date();

  let query = admin
    .from('seller_earnings')
    .select('*')
    .eq('status', 'pending')
    .lte('release_at', now.toISOString())
    .order('release_at', { ascending: true })
    .limit(opts.limit ?? 200);
  if (opts.sellerAccountId) query = query.eq('seller_account_id', opts.sellerAccountId);

  const { data: rows, error } = await query;
  if (error) {
    console.error('[Payouts] failed to load due earnings', error);
    return { considered: 0, transferred: 0, failed: 0 };
  }
  const earnings = (rows ?? []) as SellerEarningRow[];
  if (earnings.length === 0) return { considered: 0, transferred: 0, failed: 0 };

  const sellerIds = [...new Set(earnings.map((e) => e.seller_account_id))];
  const { data: accounts } = await admin
    .from('stripe_connect_accounts')
    .select('user_id, stripe_account_id, payouts_enabled')
    .in('user_id', sellerIds);
  const bySeller = new Map(
    (accounts ?? []).map((a) => [a.user_id as string, a as { stripe_account_id: string; payouts_enabled: boolean }]),
  );

  let transferred = 0;
  let failed = 0;
  for (const earning of earnings) {
    const acct = bySeller.get(earning.seller_account_id);
    if (!acct || !isDueForTransfer(earning, !!acct.payouts_enabled, now)) continue;
    if (await transferEarning(stripe, admin, earning, acct.stripe_account_id)) transferred++;
    else failed++;
  }

  console.log('[Payouts] payDueEarnings done', { considered: earnings.length, transferred, failed });
  return { considered: earnings.length, transferred, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refunds and disputes
// ─────────────────────────────────────────────────────────────────────────────

/** Hold (or claw back) every earning paid from a charge when it is refunded or disputed. */
export async function handleChargeReversal(
  stripe: Stripe,
  chargeId: string,
  reason: 'refund' | 'dispute',
): Promise<void> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data } = await admin.from('seller_earnings').select('*').eq('charge_id', chargeId);
  const earnings = (data ?? []) as SellerEarningRow[];
  for (const earning of earnings) {
    await reverseOneEarning(stripe, admin, earning, chargeId, reason);
  }
  if (earnings.length > 0 && reason === 'refund') {
    const sessionId = earnings[0]!.checkout_session_id;
    await admin
      .from('orders')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('checkout_session_id', sessionId)
      .eq('status', 'paid');
  }
}

async function reverseOneEarning(
  stripe: Stripe,
  admin: UntypedSupabaseClient,
  earning: SellerEarningRow,
  chargeId: string,
  reason: 'refund' | 'dispute',
): Promise<void> {
  const { next, reverseTransfer } = statusAfterRefundOrDispute(earning.status);
  if (next === earning.status) return;

  if (reverseTransfer && earning.transfer_id) {
    try {
      await stripe.transfers.createReversal(
        earning.transfer_id,
        { metadata: { reason, charge_id: chargeId } },
        { idempotencyKey: `reverse-${earning.id}` },
      );
    } catch (err) {
      console.error('[Payouts] transfer reversal failed', { earningId: earning.id, err });
      await notifyAdmins({
        title: 'Seller payout reversal failed',
        message: `Couldn't reverse the payout for "${earning.artwork_title ?? 'artwork'}" after a ${reason}. Check Stripe.`,
        metadata: { kind: 'payout_reversal_failed', earning_id: earning.id, charge_id: chargeId },
        logTag: 'Payouts',
      });
      return;
    }
  }

  await admin
    .from('seller_earnings')
    .update({ status: next, held_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', earning.id);

  await notifyAdmins({
    title: reason === 'dispute' ? 'Shop sale disputed' : 'Shop sale refunded',
    message: `"${earning.artwork_title ?? 'Artwork'}" (${formatMoney(earning.gross_cents, earning.currency)}): seller earning is now ${next}.`,
    metadata: { kind: `shop_${reason}`, earning_id: earning.id, charge_id: chargeId },
    logTag: 'Payouts',
  });
}
