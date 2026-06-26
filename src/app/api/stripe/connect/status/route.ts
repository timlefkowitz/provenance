import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getConnectAccount } from '~/lib/stripe-connect';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function GET(_req: NextRequest) {
  console.log('[StripeConnect] status started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connectAccount = await getConnectAccount(user.id);
    if (!connectAccount) {
      return NextResponse.json({ connected: false });
    }

    const stripe = getStripe();
    if (!stripe) {
      console.error('[StripeConnect] status: STRIPE_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Billing not configured. Cannot verify account status.' },
        { status: 503 },
      );
    }

    // Refresh from Stripe
    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);
    const admin = getSupabaseServerAdminClient();
    await (admin as any)
      .from('stripe_connect_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    console.log('[StripeConnect] Status refreshed', {
      userId: user.id,
      chargesEnabled: account.charges_enabled,
    });

    return NextResponse.json({
      connected: true,
      stripe_account_id: connectAccount.stripe_account_id,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    console.error('[StripeConnect] status failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to retrieve account status' },
      { status: 500 },
    );
  }
}
