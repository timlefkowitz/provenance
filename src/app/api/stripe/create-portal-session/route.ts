import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || !key.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  console.log('[Stripe] createPortalSession started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      console.error('[Stripe] STRIPE_SECRET_KEY not set');
      return NextResponse.json(
        { error: 'Billing not configured' },
        { status: 503 }
      );
    }

    const admin = getSupabaseServerAdminClient();
    const { data: row } = await (admin as any)
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!row?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Subscribe first.' },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const returnUrl = `${siteUrl}/subscription`;

    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log('[Stripe] Portal session created for customer', row.stripe_customer_id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] createPortalSession failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
