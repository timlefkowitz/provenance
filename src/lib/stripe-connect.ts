import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type ConnectAccount = {
  stripe_account_id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  account_kind?: 'express' | 'platform';
};

/**
 * Fetches the stored Stripe Connect account for a user (admin client).
 * Returns null if none exists.
 */
export async function getConnectAccount(userId: string): Promise<ConnectAccount | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await asUntyped(admin)
    .from('stripe_connect_accounts')
    .select('stripe_account_id, charges_enabled, details_submitted, payouts_enabled, account_kind')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[StripeConnect] getConnectAccount query failed', error);
    return null;
  }
  return data ?? null;
}

/**
 * Returns true when the user has opened a shop. Buyers pay Provenance, so the
 * seller needs no plan and no finished payout setup to take a sale: opening
 * the shop creates their payout account, and payout details can come later.
 */
export async function isSellingEnabled(userId: string): Promise<boolean> {
  try {
    const connect = await getConnectAccount(userId);
    return !!connect;
  } catch (err) {
    console.error('[StripeConnect] isSellingEnabled failed', err);
    return false;
  }
}
