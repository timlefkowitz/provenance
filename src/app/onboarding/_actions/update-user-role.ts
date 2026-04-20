'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { isValidRole, type UserRole } from '~/lib/user-roles';

export async function updateUserRole(role: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Validate role
  if (!isValidRole(role)) {
    throw new Error('Invalid role. Must be collector, artist, gallery, or institution.');
  }

  // Get existing public data
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const currentPublicData = (account?.public_data as Record<string, any>) || {};

  // Update public_data with new role
  const { error } = await client
    .from('accounts')
    .update({
      public_data: {
        ...currentPublicData,
        role: role as UserRole,
      },
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  // Keep the user's free trial role in sync for UI consistency.
  // (Trial entitlement uses deterministic `stripe_subscription_id = trial_<userId>`.)
  try {
    const admin = getSupabaseServerAdminClient();
    const trialStripeSubscriptionId = `trial_${user.id}`;

    console.log('[Billing] sync trial role', { userId: user.id, role });

    await (admin as any)
      .from('subscriptions')
      .update({ role: role as UserRole })
      .eq('user_id', user.id)
      .eq('stripe_subscription_id', trialStripeSubscriptionId);
  } catch (trialErr) {
    console.error('[Billing] failed to sync trial role', trialErr);
    // Do not fail onboarding; role change to accounts is the primary operation.
  }

  revalidatePath('/', 'layout');
}


