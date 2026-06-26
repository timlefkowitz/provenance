import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getConnectAccount } from '~/lib/stripe-connect';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  console.log('[StripeConnect] account-link started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
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

    const body = await req.json().catch(() => ({}));
    const type: 'account_onboarding' | 'account_update' =
      body.type === 'account_update' ? 'account_update' : 'account_onboarding';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const returnUrl = `${siteUrl}/settings?connect=return`;
    const refreshUrl = `${siteUrl}/settings?connect=refresh`;

    const link = await stripe.accountLinks.create({
      account: connectAccount.stripe_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    });

    console.log('[StripeConnect] Account link created', { userId: user.id });
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error('[StripeConnect] account-link failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create account link' },
      { status: 500 },
    );
  }
}
