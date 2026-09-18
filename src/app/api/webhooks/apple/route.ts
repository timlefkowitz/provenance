import { NextRequest, NextResponse } from 'next/server';
import { NotificationTypeV2 } from '@apple/app-store-server-library';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { APPLE_PRODUCT_TO_PLAN } from '~/lib/capacitor/apple-iap-config';
import { verifyNotificationPayload, verifyTransactionJWS } from '~/lib/apple/verify-apple-jws';
import type { SubscriptionRole } from '~/lib/stripe-config';
import { upsertAppleSubscription } from '~/lib/apple/upsert-apple-subscription';

export const runtime = 'nodejs';

type MappedStatus = 'active' | 'past_due' | 'canceled' | 'ignore';

/**
 * Maps App Store Server Notifications V2 event types to our
 * `subscriptions.status` column.
 */
export function mapNotificationToStatus(notificationType: string | undefined): MappedStatus {
  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
    case NotificationTypeV2.OFFER_REDEEMED:
    case NotificationTypeV2.REFUND_REVERSED:
    case NotificationTypeV2.RENEWAL_EXTENDED:
    case NotificationTypeV2.RENEWAL_EXTENSION:
      return 'active';

    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      return 'past_due';

    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.REVOKE:
      return 'canceled';

    // Informational only — no status change for our table.
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS:
    case NotificationTypeV2.REFUND_DECLINED:
    case NotificationTypeV2.PRICE_INCREASE:
    case NotificationTypeV2.CONSUMPTION_REQUEST:
    case NotificationTypeV2.TEST:
    default:
      return 'ignore';
  }
}

export async function POST(request: NextRequest) {
  let body: { signedPayload?: string } | null;
  try {
    body = await request.json();
  } catch (err) {
    console.error('[AppleIAP] Webhook: failed to parse JSON body', err);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body?.signedPayload) {
    return NextResponse.json({ error: 'Missing signedPayload' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await verifyNotificationPayload(body.signedPayload);
  } catch (err) {
    // The JWS signature is the sole proof of authenticity — reject rather
    // than treating this as a legitimate, ignorable event.
    console.error('[AppleIAP] Webhook: signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  console.log('[AppleIAP] Webhook event received', {
    type: decoded.notificationType,
    subtype: decoded.subtype,
    notificationUUID: decoded.notificationUUID,
  });

  const status = mapNotificationToStatus(decoded.notificationType);
  if (status === 'ignore') {
    console.log('[AppleIAP] Webhook ignored event', { type: decoded.notificationType });
    return NextResponse.json({ received: true });
  }

  const signedTransactionInfo = decoded.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    return NextResponse.json({ received: true });
  }

  let transaction;
  try {
    transaction = await verifyTransactionJWS(signedTransactionInfo);
  } catch (err) {
    console.error('[AppleIAP] Webhook: nested transaction verification failed', err);
    return NextResponse.json({ error: 'Invalid transaction signature' }, { status: 401 });
  }

  if (!transaction.originalTransactionId) {
    return NextResponse.json({ received: true, error: 'missing_original_transaction_id' });
  }

  const plan = transaction.productId ? APPLE_PRODUCT_TO_PLAN[transaction.productId] : undefined;
  const admin = asUntyped(getSupabaseServerAdminClient());

  if (status === 'past_due') {
    // Update-only — never create a row from a webhook alone.
    await admin
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('apple_original_transaction_id', transaction.originalTransactionId);
    console.error('[AppleIAP] Billing issue, marked past_due', {
      originalTransactionId: transaction.originalTransactionId,
      productId: transaction.productId,
    });
    return NextResponse.json({ received: true });
  }

  // Apple's notifications carry no concept of our internal user id, except
  // via appAccountToken when the client stamped one on purchase(). Prefer
  // that; otherwise fall back to updating a row that eager sync already
  // created (the dominant path — see sync-apple-entitlement.ts).
  const userId = transaction.appAccountToken ?? null;

  const updatePayload: Record<string, unknown> = {
    status,
    current_period_end: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (plan) updatePayload.role = plan.role as SubscriptionRole;

  if (userId && !plan) {
    console.error('[AppleIAP] Webhook: unknown product_id, cannot resolve role', {
      productId: transaction.productId,
      originalTransactionId: transaction.originalTransactionId,
    });
    return NextResponse.json({ received: true, error: 'unknown_product' });
  }

  if (userId && plan) {
    const { error } = await upsertAppleSubscription(admin, {
      user_id: userId,
      provider: 'apple_iap',
      revenuecat_subscriber_id: userId,
      apple_original_transaction_id: transaction.originalTransactionId,
      role: plan.role as SubscriptionRole,
      status,
      current_period_end: updatePayload.current_period_end,
      updated_at: updatePayload.updated_at,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    });
    if (error) {
      console.error('[AppleIAP] Webhook: upsert failed', { error, originalTransactionId: transaction.originalTransactionId });
      return NextResponse.json({ received: true, error: 'upsert_failed' });
    }
    return NextResponse.json({ received: true });
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .maybeSingle();

  if (!existing) {
    console.warn('[AppleIAP] Webhook: notification for unknown transaction — eager sync has not landed yet', {
      originalTransactionId: transaction.originalTransactionId,
      notificationType: decoded.notificationType,
    });
    return NextResponse.json({ received: true, warning: 'unknown_transaction' });
  }

  const { error } = await admin
    .from('subscriptions')
    .update(updatePayload)
    .eq('apple_original_transaction_id', transaction.originalTransactionId);

  if (error) {
    console.error('[AppleIAP] Webhook: update failed', { error, originalTransactionId: transaction.originalTransactionId });
    return NextResponse.json({ received: true, error: 'update_failed' });
  }

  return NextResponse.json({ received: true });
}
