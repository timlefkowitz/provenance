'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  APPLE_PRODUCT_TO_PLAN,
  getRevenueCatSecretKey,
} from '~/lib/capacitor/revenuecat-config';
import type { SubscriptionRole } from '~/lib/stripe-config';

type RevenueCatSubscriberEntitlement = {
  expires_date: string | null;
  product_identifier: string;
  purchase_date: string;
  original_purchase_date: string;
  ownership_type: string;
  period_type: string;
};

type RevenueCatSubscriberInfo = {
  subscriber: {
    entitlements: Record<string, RevenueCatSubscriberEntitlement>;
    subscriptions: Record<string, {
      expires_date: string | null;
      original_transaction_id: string | null;
      billing_issues_detected_at: string | null;
      period_type: string;
    }>;
  };
};

/**
 * Eagerly syncs Apple IAP entitlement from RevenueCat REST API after a native
 * purchase. Called client-side immediately after Purchases.purchasePackage()
 * succeeds so the user doesn't have to wait for the webhook.
 *
 * Args:
 *   originalTransactionId — from the RevenueCat CustomerInfo returned by the SDK
 *   productId             — e.g. "com.provenance.app.artist.monthly"
 *   expirationDateMs      — from the SDK's CustomerInfo (ms since epoch), or null
 */
export async function syncAppleEntitlement(
  originalTransactionId: string,
  productId: string,
  expirationDateMs: number | null,
): Promise<{ success: boolean; error?: string }> {
  console.log('[RevenueCat] syncAppleEntitlement started', { originalTransactionId, productId });

  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'unauthenticated' };

    const plan = APPLE_PRODUCT_TO_PLAN[productId];
    if (!plan) {
      console.error('[RevenueCat] syncAppleEntitlement: unknown productId', { productId });
      return { success: false, error: 'unknown_product' };
    }

    // Optionally verify with RevenueCat REST API to cross-check expiration.
    // This is best-effort — if RC API is slow we still trust the SDK's data.
    let currentPeriodEnd: string | null = expirationDateMs
      ? new Date(expirationDateMs).toISOString()
      : null;

    const rcSecretKey = getRevenueCatSecretKey();
    if (rcSecretKey) {
      try {
        const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${user.id}`, {
          headers: {
            Authorization: `Bearer ${rcSecretKey}`,
            'X-Platform': 'ios',
          },
        });
        if (res.ok) {
          const body = (await res.json()) as RevenueCatSubscriberInfo;
          const sub = body.subscriber?.subscriptions?.[productId];
          if (sub?.expires_date) {
            currentPeriodEnd = sub.expires_date;
          }
        }
      } catch (rcErr) {
        console.error('[RevenueCat] syncAppleEntitlement: RC REST API call failed (non-fatal)', rcErr);
      }
    }

    const admin = asUntyped(getSupabaseServerAdminClient());
    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: user.id,
        provider: 'apple_iap',
        revenuecat_subscriber_id: user.id,
        apple_original_transaction_id: originalTransactionId,
        role: plan.role as SubscriptionRole,
        status: 'active',
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
      },
      { onConflict: 'apple_original_transaction_id' },
    );

    if (error) {
      console.error('[RevenueCat] syncAppleEntitlement: upsert failed', error);
      return { success: false, error: 'upsert_failed' };
    }

    console.log('[RevenueCat] syncAppleEntitlement completed', {
      userId: user.id,
      role: plan.role,
      productId,
    });
    return { success: true };
  } catch (err) {
    console.error('[RevenueCat] syncAppleEntitlement threw', err);
    return { success: false, error: (err as Error).message };
  }
}
