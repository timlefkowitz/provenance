import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendWelcomeEmail } from '~/lib/email';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { asUntyped } from '~/lib/supabase-untyped';

export type ProvisionResult = {
  /** True when the account was created within the last 2 minutes. */
  isNewUser: boolean;
};

/**
 * Provision a 14-day free trial and send a welcome email for a user who just
 * completed authentication (OAuth callback or email confirmation). Idempotent —
 * safe to call on every sign-in; the trial row is only created once.
 *
 * Errors are swallowed and logged so they never block the auth redirect.
 */
export async function provisionNewUser(userId: string): Promise<ProvisionResult> {
  console.log('[Auth/Provision] started', { userId });

  const now = new Date();
  const nowIso = now.toISOString();
  const trialDays = 14;
  const trialEndIso = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  const trialStripeSubscriptionId = `trial_${userId}`;

  let isNewUser = false;

  try {
    const admin = asUntyped(getSupabaseServerAdminClient());

    const { data: account } = await admin
      .from('accounts')
      .select('email, name, created_at, public_data')
      .eq('id', userId)
      .single();

    if (!account) {
      console.warn('[Auth/Provision] account row not found', { userId });
      return { isNewUser: false };
    }

    const accountRole = getUserRole((account.public_data as Record<string, unknown> | null) ?? null);
    const role = accountRole ?? USER_ROLES.ARTIST;

    // Trial provisioning —————————————————————————————————————————————————————
    try {
      const { data: eligibleSubscriptionRows } = await admin
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .or(`current_period_end.is.null,current_period_end.gte.${nowIso}`)
        .limit(1);

      const { data: existingTrialRows } = await admin
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', trialStripeSubscriptionId)
        .limit(1);

      const hasEligibleSubscription = (eligibleSubscriptionRows?.length ?? 0) > 0;
      const hasExistingTrialRow = (existingTrialRows?.length ?? 0) > 0;

      if (!hasEligibleSubscription && !hasExistingTrialRow) {
        await admin.from('subscriptions').insert({
          user_id: userId,
          stripe_customer_id: null,
          stripe_subscription_id: trialStripeSubscriptionId,
          stripe_price_id: null,
          status: 'trialing',
          current_period_end: trialEndIso,
          trial_end: trialEndIso,
          role,
          updated_at: nowIso,
        });
        console.log('[Billing] trial provisioned', { userId });
      } else {
        console.log('[Billing] trial provisioning skipped', {
          userId,
          hasEligibleSubscription,
          hasExistingTrialRow,
        });
      }
    } catch (trialErr) {
      console.error('[Billing] trial provisioning failed', trialErr);
    }

    // New-user detection + welcome email ————————————————————————————————————
    try {
      if (account.email && account.created_at) {
        const createdAt = new Date(account.created_at);
        const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

        if (minutesSinceCreation < 2) {
          isNewUser = true;
          const userName = account.name || (account.email as string).split('@')[0] || 'there';

          sendWelcomeEmail(account.email as string, userName).catch((err) => {
            console.error('[Auth/Provision] welcome email failed', err);
          });
        }
      }
    } catch (emailErr) {
      console.error('[Auth/Provision] new-user check failed', emailErr);
    }
  } catch (err) {
    console.error('[Auth/Provision] unexpected error', err);
  }

  console.log('[Auth/Provision] complete', { userId, isNewUser });
  return { isNewUser };
}
