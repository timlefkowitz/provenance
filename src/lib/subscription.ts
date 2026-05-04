import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Returns the current user's eligible subscription if any (any billing role).
 * Used to gate subscription-gated features (e.g. Grants, Open Calls, grants assistant).
 * Certificates remain free for everyone.
 */
export async function getActiveSubscription(userId: string): Promise<{
  id: string;
  role: string;
  status: string;
  current_period_end: string | null;
} | null> {
  const client = getSupabaseServerClient();
  const now = new Date().toISOString();
  const { data: rows } = await (client as any)
    .from('subscriptions')
    .select('id, role, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .or(`current_period_end.is.null,current_period_end.gte.${now}`)
    .order('current_period_end', { ascending: false })
    .limit(1);

  const row = rows?.[0] ?? null;
  if (!row) return null;
  return row;
}

/**
 * (v1.5) Returns true if the user has an active custom-domain add-on subscription.
 * Checks whether any active/trialing subscription has a price ID matching either
 * STRIPE_PRICE_CUSTOM_DOMAIN_MONTHLY or STRIPE_PRICE_CUSTOM_DOMAIN_YEARLY.
 */
export async function hasCustomDomainAddon(userId: string): Promise<boolean> {
  const monthlyPriceId = process.env.STRIPE_PRICE_CUSTOM_DOMAIN_MONTHLY;
  const yearlyPriceId = process.env.STRIPE_PRICE_CUSTOM_DOMAIN_YEARLY;

  if (!monthlyPriceId && !yearlyPriceId) return false;

  const client = getSupabaseServerClient();
  const now = new Date().toISOString();
  const priceIds = [monthlyPriceId, yearlyPriceId].filter(Boolean) as string[];

  const { data: rows } = await (client as any)
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .in('stripe_price_id', priceIds)
    .or(`current_period_end.is.null,current_period_end.gte.${now}`)
    .limit(1);

  return (rows?.length ?? 0) > 0;
}
