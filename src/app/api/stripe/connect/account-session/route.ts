import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getConnectAccount } from '~/lib/stripe-connect';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST() {
  console.log('[StripeConnect] account-session started');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const connectAccount = await getConnectAccount(user.id);
    if (!connectAccount) {
      return NextResponse.json(
        { error: 'No Connect account found. Create one first.' },
        { status: 400 },
      );
    }

    const accountSession = await stripe.accountSessions.create({
      account: connectAccount.stripe_account_id,
      components: {
        account_onboarding: {
          enabled: true,
        },
      },
    });

    console.log('[StripeConnect] account-session created', { userId: user.id });
    return NextResponse.json({ client_secret: accountSession.client_secret });
  } catch (err) {
    console.error('[StripeConnect] account-session failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create account session' },
      { status: 500 },
    );
  }
}
