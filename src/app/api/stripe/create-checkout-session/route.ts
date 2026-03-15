import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  getStripePriceId,
  type SubscriptionInterval,
  type SubscriptionRole,
} from '~/lib/stripe-config';
import { isValidRole } from '~/lib/user-roles';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || !key.startsWith('sk')) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  console.log('[Stripe] createCheckoutSession started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { role, interval } = body as { role?: string; interval?: string };

    if (!role || !interval) {
      return NextResponse.json(
        { error: 'Missing role or interval' },
        { status: 400 }
      );
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const intervalNorm = interval === 'year' ? 'year' : 'month';
    const priceId = getStripePriceId(role as SubscriptionRole, intervalNorm as SubscriptionInterval);
    if (!priceId) {
      console.error('[Stripe] No price ID for role/interval', { role, interval });
      return NextResponse.json(
        { error: 'Subscription plan not configured' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      console.error('[Stripe] STRIPE_SECRET_KEY not set');
      return NextResponse.json(
        { error: 'Billing not configured' },
        { status: 503 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const successUrl = `${siteUrl}/subscription?success=1`;
    const cancelUrl = `${siteUrl}/subscription?canceled=1`;

    const admin = getSupabaseServerAdminClient();
    const { data: existing } = await (admin as any)
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId: string | null = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await (admin as any).from('stripe_customers').upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id, role },
      subscription_data: { metadata: { user_id: user.id, role } },
    });

    if (!session.url) {
      console.error('[Stripe] Checkout session created but no url', session.id);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    console.log('[Stripe] Checkout session created', session.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] createCheckoutSession failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
