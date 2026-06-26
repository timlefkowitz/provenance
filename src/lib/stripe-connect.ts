import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getActiveSubscription } from './subscription';

export type ConnectAccount = {
  stripe_account_id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
};

/**
 * Fetches the stored Stripe Connect account for a user (admin client).
 * Returns null if none exists.
 */
export async function getConnectAccount(userId: string): Promise<ConnectAccount | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await (admin as any)
    .from('stripe_connect_accounts')
    .select('stripe_account_id, charges_enabled, details_submitted, payouts_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[StripeConnect] getConnectAccount query failed', error);
    return null;
  }
  return data ?? null;
}

/**
 * Returns true when a user has an active paid subscription AND their Stripe
 * Connect account has charges enabled — i.e. they can accept artwork purchases.
 */
export async function isSellingEnabled(userId: string): Promise<boolean> {
  try {
    const [sub, connect] = await Promise.all([
      getActiveSubscription(userId),
      getConnectAccount(userId),
    ]);
    return !!(sub && connect?.charges_enabled);
  } catch (err) {
    console.error('[StripeConnect] isSellingEnabled failed', err);
    return false;
  }
}
