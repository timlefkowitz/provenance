import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getActiveSubscription } from '~/lib/subscription';
import { getDomainAvailability, normalizeFullDomain } from '~/lib/godaddy';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || !key.trim().startsWith('sk')) return null;
  return new Stripe(key.trim());
}

export async function POST(request: NextRequest) {
  console.log('[Sites] createDomainCheckoutSession started');

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getActiveSubscription(user.id);
    if (!subscription) {
      return NextResponse.json(
        { error: 'An active subscription is required to purchase a domain.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { profileId, domain, priceUsdCents } = body as {
      profileId?: string;
      domain?: string;
      priceUsdCents?: number;
    };

    if (!profileId || !domain || priceUsdCents == null) {
      return NextResponse.json(
        { error: 'Missing profileId, domain, or priceUsdCents' },
        { status: 400 },
      );
    }

    const normalizedDomain = normalizeFullDomain(domain);
    if (!normalizedDomain) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    if (!Number.isInteger(priceUsdCents) || priceUsdCents < 100) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }

    const { data: siteRow, error: siteErr } = await (client as any)
      .from('profile_sites')
      .select('profile_id, handle, custom_domain')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (siteErr || !siteRow) {
      return NextResponse.json({ error: 'Site not found. Save your site first.' }, { status: 400 });
    }

    if (siteRow.custom_domain) {
      return NextResponse.json(
        { error: 'This site already has a custom domain connected.' },
        { status: 400 },
      );
    }

    const { data: profile } = await (client as any)
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .maybeSingle();

    if (!profile || profile.user_id !== user.id) {
      return NextResponse.json({ error: 'Profile not owned by you' }, { status: 403 });
    }

    const availability = await getDomainAvailability(normalizedDomain);
    if (!availability?.available || availability.priceUsdCents == null) {
      return NextResponse.json(
        { error: 'Domain is no longer available. Search again.' },
        { status: 400 },
      );
    }

    if (availability.priceUsdCents !== priceUsdCents) {
      console.error('[Sites] createDomainCheckoutSession price mismatch', {
        domain: normalizedDomain,
        clientPrice: priceUsdCents,
        serverPrice: availability.priceUsdCents,
      });
      return NextResponse.json(
        { error: 'Price has changed. Search again before purchasing.' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const successUrl = `${siteUrl}/profile/site?profileId=${profileId}&domain_purchased=1`;
    const cancelUrl = `${siteUrl}/profile/site?profileId=${profileId}&domain_canceled=1`;

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
        { onConflict: 'user_id' },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Domain: ${normalizedDomain}`,
              description: '1-year domain registration via Provenance',
            },
            unit_amount: priceUsdCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'domain_purchase',
        user_id: user.id,
        profile_id: profileId,
        domain: normalizedDomain,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    const { error: insertErr } = await (admin as any).from('domain_purchases').insert({
      user_id: user.id,
      profile_id: profileId,
      domain: normalizedDomain,
      stripe_checkout_session_id: session.id,
      status: 'pending',
      price_usd_cents: priceUsdCents,
    });

    if (insertErr) {
      console.error('[Sites] createDomainCheckoutSession domain_purchases insert failed', insertErr);
      return NextResponse.json({ error: 'Failed to record domain purchase' }, { status: 500 });
    }

    console.log('[Sites] createDomainCheckoutSession success', {
      sessionId: session.id,
      domain: normalizedDomain,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[Sites] createDomainCheckoutSession failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
