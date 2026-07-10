import { asUntyped } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getActiveSubscription } from '~/lib/subscription';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST(_req: NextRequest) {
  console.log('[StripeConnect] create-account started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await getActiveSubscription(user.id);
    if (!sub) {
      return NextResponse.json(
        { error: 'An active subscription is required to sell artworks.' },
        { status: 403 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const admin = getSupabaseServerAdminClient();

    // Return existing account if already created
    const { data: existing } = await asUntyped(admin)
      .from('stripe_connect_accounts')
      .select('stripe_account_id, charges_enabled, details_submitted')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      console.log('[StripeConnect] Returning existing account', { userId: user.id });
      return NextResponse.json({ accountId: existing.stripe_account_id });
    }

    // Create a new Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });

    const { error: insertError } = await admin.from('stripe_connect_accounts').insert({
      user_id: user.id,
      stripe_account_id: account.id,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
    });

    if (insertError) {
      console.error('[StripeConnect] Failed to persist Connect account', {
        userId: user.id,
        accountId: account.id,
        error: insertError,
      });
      return NextResponse.json(
        { error: 'Stripe account created but could not be saved. Please contact support.' },
        { status: 500 },
      );
    }

    console.log('[StripeConnect] Created Express account', { userId: user.id, accountId: account.id });
    return NextResponse.json({ accountId: account.id });
  } catch (err) {
    console.error('[StripeConnect] create-account failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create account' },
      { status: 500 },
    );
  }
}
