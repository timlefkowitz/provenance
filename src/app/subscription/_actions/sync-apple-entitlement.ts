'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { APPLE_PRODUCT_TO_PLAN } from '~/lib/capacitor/apple-iap-config';
import { verifyTransactionJWS } from '~/lib/apple/verify-apple-jws';
import type { SubscriptionRole } from '~/lib/stripe-config';
import { logger } from '~/lib/logger';

/**
 * Eagerly syncs an Apple IAP entitlement after a native purchase or restore.
 * Called client-side immediately after StoreKit's purchase()/restorePurchases()
 * resolves, so the user doesn't have to wait for the App Store Server
 * Notifications webhook.
 *
 * jwsRepresentation is StoreKit 2's own signed transaction — verifying it here
 * (rather than trusting client-supplied fields) makes originalTransactionId
 * and expiresDate authoritative without any round-trip to Apple's servers.
 */
export async function syncAppleEntitlement(
  jwsRepresentation: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[AppleIAP] syncAppleEntitlement started', { productId });

  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'unauthenticated' };

    const plan = APPLE_PRODUCT_TO_PLAN[productId];
    if (!plan) {
      console.error('[AppleIAP] syncAppleEntitlement: unknown productId', { productId });
      return { success: false, error: 'unknown_product' };
    }

    let decoded;
    try {
      decoded = await verifyTransactionJWS(jwsRepresentation);
    } catch (err) {
      logger.error('apple_iap_sync_verification_failed', {
        productId,
        message: (err as Error)?.message,
        status: (err as { status?: unknown })?.status as number | undefined,
      });
      return { success: false, error: 'verification_failed' };
    }

    if (decoded.productId !== productId || !decoded.originalTransactionId) {
      console.error('[AppleIAP] syncAppleEntitlement: decoded transaction mismatch', {
        expectedProductId: productId,
        decodedProductId: decoded.productId,
      });
      return { success: false, error: 'mismatched_transaction' };
    }

    const admin = asUntyped(getSupabaseServerAdminClient());
    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: user.id,
        provider: 'apple_iap',
        revenuecat_subscriber_id: user.id,
        apple_original_transaction_id: decoded.originalTransactionId,
        role: plan.role as SubscriptionRole,
        status: 'active',
        current_period_end: decoded.expiresDate ? new Date(decoded.expiresDate).toISOString() : null,
        updated_at: new Date().toISOString(),
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
      },
      { onConflict: 'apple_original_transaction_id' },
    );

    if (error) {
      logger.error('apple_iap_sync_upsert_failed', {
        userId: user.id,
        productId,
        message: error.message,
        code: error.code,
      });
      return { success: false, error: 'upsert_failed' };
    }

    console.log('[AppleIAP] syncAppleEntitlement completed', {
      userId: user.id,
      role: plan.role,
      productId,
    });
    return { success: true };
  } catch (err) {
    console.error('[AppleIAP] syncAppleEntitlement threw', err);
    return { success: false, error: (err as Error).message };
  }
}
