import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  APPLE_PRODUCT_TO_PLAN,
  getRevenueCatWebhookSecret,
} from '~/lib/capacitor/revenuecat-config';
import type { SubscriptionRole } from '~/lib/stripe-config';

/**
 * RevenueCat sends its shared secret in the Authorization header (plain, not
 * Bearer). We do a constant-time comparison to avoid timing attacks.
 */
function verifyRevenueCatAuth(authHeader: string | null): boolean {
  const secret = getRevenueCatWebhookSecret();
  if (!secret || !authHeader) return false;
  // Simple constant-time-ish compare
  if (secret.length !== authHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= secret.charCodeAt(i) ^ authHeader.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Resolves the Supabase user_id from a RevenueCat event.
 * We use the Supabase user_id as the RevenueCat app_user_id, so they are
 * the same value. We still validate it exists in our DB before writing.
 */
async function resolveUserId(
  admin: ReturnType<typeof asUntyped>,
  appUserId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('accounts')
    .select('id')
    .eq('id', appUserId)
    .single();

  if (error || !data) {
    console.error('[RevenueCat] Webhook: app_user_id not found in accounts', { appUserId, error });
    return null;
  }
  return data.id;
}

type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIBER_ALIAS'
  | 'TEST'
  | string;

type RevenueCatEvent = {
  type: RevenueCatEventType;
  id: string;
  app_user_id: string;
  original_app_user_id: string;
  product_id: string;
  entitlement_ids: string[] | null;
  period_type: 'NORMAL' | 'TRIAL' | 'INTRO' | string;
  purchased_at_ms: number | null;
  expiration_at_ms: number | null;
  original_transaction_id: string;
  store: 'APP_STORE' | 'PLAY_STORE' | string;
};

type RevenueCatPayload = {
  api_version: string;
  event: RevenueCatEvent;
};

function msToIso(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

async function upsertFromRevenueCatEvent(
  admin: ReturnType<typeof asUntyped>,
  event: RevenueCatEvent,
  status: 'active' | 'canceled',
): Promise<{ ok: boolean; reason?: string }> {
  const userId = await resolveUserId(admin, event.original_app_user_id || event.app_user_id);
  if (!userId) return { ok: false, reason: 'unresolved_user' };

  const plan = APPLE_PRODUCT_TO_PLAN[event.product_id];
  if (!plan) {
    console.error('[RevenueCat] Webhook: unknown product_id, cannot resolve role', {
      product_id: event.product_id,
      eventId: event.id,
    });
    return { ok: false, reason: 'unknown_product' };
  }

  const { role } = plan;
  const currentPeriodEnd = msToIso(event.expiration_at_ms);

  const subscriptionStatus =
    status === 'canceled'
      ? 'canceled'
      : event.period_type === 'TRIAL'
        ? 'trialing'
        : 'active';

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'apple_iap',
      revenuecat_subscriber_id: userId,
      apple_original_transaction_id: event.original_transaction_id,
      role: role as SubscriptionRole,
      status: subscriptionStatus,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
      // Stripe columns intentionally null for Apple IAP rows
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    },
    { onConflict: 'apple_original_transaction_id' },
  );

  if (error) {
    console.error('[RevenueCat] Webhook: subscriptions upsert failed', {
      originalTransactionId: event.original_transaction_id,
      userId,
      error,
    });
    return { ok: false, reason: 'upsert_failed' };
  }

  return { ok: true };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!verifyRevenueCatAuth(authHeader)) {
    console.error('[RevenueCat] Webhook: authorization failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: RevenueCatPayload;
  try {
    payload = (await request.json()) as RevenueCatPayload;
  } catch (err) {
    console.error('[RevenueCat] Webhook: failed to parse JSON body', err);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const event = payload?.event;
  if (!event?.type) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 });
  }

  console.log('[RevenueCat] Webhook event received', {
    type: event.type,
    id: event.id,
    product_id: event.product_id,
    app_user_id: event.app_user_id,
  });

  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        const result = await upsertFromRevenueCatEvent(admin, event, 'active');
        if (!result.ok) {
          return NextResponse.json({ received: true, error: result.reason });
        }
        console.log('[RevenueCat] Subscription activated/renewed', {
          type: event.type,
          product_id: event.product_id,
          app_user_id: event.app_user_id,
        });
        return NextResponse.json({ received: true });
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        const result = await upsertFromRevenueCatEvent(admin, event, 'canceled');
        if (!result.ok) {
          return NextResponse.json({ received: true, error: result.reason });
        }
        console.log('[RevenueCat] Subscription canceled/expired', {
          type: event.type,
          product_id: event.product_id,
          app_user_id: event.app_user_id,
        });
        return NextResponse.json({ received: true });
      }

      case 'BILLING_ISSUE': {
        // Keep the subscription row but mark it past_due so the user sees a
        // warning. Apple will retry the charge and send RENEWAL on success.
        const userId = await resolveUserId(admin, event.original_app_user_id || event.app_user_id);
        if (userId) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('apple_original_transaction_id', event.original_transaction_id);
          console.error('[RevenueCat] Billing issue, marked past_due', {
            userId,
            product_id: event.product_id,
          });
        }
        return NextResponse.json({ received: true });
      }

      case 'TEST':
        console.log('[RevenueCat] Webhook test event received — OK');
        return NextResponse.json({ received: true });

      default:
        console.log('[RevenueCat] Webhook ignored event', { type: event.type });
        return NextResponse.json({ received: true });
    }
  } catch (err) {
    console.error('[RevenueCat] Webhook: handler threw', { type: event.type, err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
