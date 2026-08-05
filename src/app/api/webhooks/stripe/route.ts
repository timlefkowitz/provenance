import { asUntyped, UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { fulfillDomainPurchase } from '~/lib/domain-purchase-fulfillment';
import { captureCrmContacts } from '~/lib/crm/capture-contact';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || !key.startsWith('sk')) return null;
  return new Stripe(key);
}

function getWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  return typeof secret === 'string' && secret.trim() ? secret.trim() : null;
}

type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

const ALLOWED_STATUSES: SubscriptionStatus[] = [
  'active',
  'canceled',
  'past_due',
  'unpaid',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'paused',
];

const ALLOWED_ROLES = ['artist', 'collector', 'gallery', 'institution'] as const;

function toSubscriptionStatus(s: string): SubscriptionStatus {
  return ALLOWED_STATUSES.includes(s as SubscriptionStatus)
    ? (s as SubscriptionStatus)
    : 'canceled';
}

/**
 * Resolve user_id for a subscription. Prefers metadata; falls back to looking
 * up the customer in our stripe_customers table. This protects against
 * subscriptions created via the Stripe Dashboard (no metadata) or any case
 * where checkout failed to attach metadata to subscription_data.
 */
async function resolveUserAndRole(
  admin: UntypedSupabaseClient,
  subscription: Stripe.Subscription,
): Promise<{ userId: string; role: string } | null> {
  const metaUserId = (subscription.metadata?.user_id as string) || null;
  const metaRole = (subscription.metadata?.role as string) || null;

  if (metaUserId && metaRole && (ALLOWED_ROLES as readonly string[]).includes(metaRole)) {
    return { userId: metaUserId, role: metaRole };
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;
  if (!customerId) return null;

  const { data: customerRow } = await asUntyped(admin)
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  const userId = customerRow?.user_id ?? null;
  if (!userId) return null;

  // If we recovered the user but role metadata is missing, try to read it
  // from a previously-synced subscription row for this user (best-effort).
  let role = metaRole && (ALLOWED_ROLES as readonly string[]).includes(metaRole) ? metaRole : null;
  if (!role) {
    const { data: priorSub } = await asUntyped(admin)
      .from('subscriptions')
      .select('role')
      .eq('user_id', userId)
      .neq('role', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    role = priorSub?.role ?? null;
  }

  if (!userId || !role) return null;
  return { userId, role };
}

async function upsertFromSubscription(
  admin: UntypedSupabaseClient,
  subscription: Stripe.Subscription,
  options?: { forceStatus?: 'canceled' },
): Promise<{ ok: boolean; reason?: string }> {
  const subscriptionId = subscription.id;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const status = options?.forceStatus
    ? options.forceStatus
    : toSubscriptionStatus(subscription.status);

  const resolved = await resolveUserAndRole(admin, subscription);
  if (!resolved) {
    console.error('[Stripe] Webhook: cannot resolve user_id/role', {
      subscriptionId,
      metadata: subscription.metadata,
      customerId,
    });
    return { ok: false, reason: 'unresolved_user_role' };
  }
  const { userId, role } = resolved;

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status,
      current_period_end: currentPeriodEnd,
      trial_end: trialEnd,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );
  if (error) {
    console.error('[Stripe] Webhook: subscriptions upsert failed', {
      subscriptionId,
      error,
    });
    return { ok: false, reason: 'upsert_failed' };
  }

  // A real Stripe subscription now covers this user — cancel any lingering
  // local app-provisioned trial row so stale "trial ending" banners/emails
  // stop showing immediately, instead of waiting on the daily reconcile cron.
  if (status === 'active' || status === 'trialing') {
    const { error: staleErr } = await admin
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'trialing')
      .like('stripe_subscription_id', 'trial_%');
    if (staleErr) {
      console.error('[Stripe] Webhook: failed to cancel stale trial row', {
        userId,
        staleErr,
      });
    }
  }

  return { ok: true };
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  if (!stripe || !webhookSecret) {
    console.error('[Stripe] Webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error('[Stripe] Webhook: failed to read body', err);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[Stripe] Webhook event received', {
    type: event.type,
    id: event.id,
  });

  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const result = await upsertFromSubscription(admin, subscription);
        if (!result.ok) {
          // Don't 500 — Stripe will retry forever otherwise. We've logged it.
          return NextResponse.json({ received: true, error: result.reason });
        }
        return NextResponse.json({ received: true });
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await asUntyped(admin)
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        return NextResponse.json({ received: true });
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.type === 'domain_purchase') {
          console.log('[Sites] Webhook: domain purchase checkout completed', {
            sessionId: session.id,
            domain: session.metadata.domain,
          });
          const agreedByIp = process.env.GODADDY_CONSENT_IP ?? '0.0.0.0';
          const result = await fulfillDomainPurchase(session.id, agreedByIp);
          if (!result.ok) {
            console.error('[Sites] Webhook: domain purchase fulfillment failed', result.error);
          }
          return NextResponse.json({ received: true, error: result.ok ? undefined : result.error });
        }

        if (session.metadata?.type === 'artwork_purchase') {
          const artworkId = session.metadata.artwork_id;
          const ownerAccountId = session.metadata.owner_account_id;
          const buyerEmail = session.customer_details?.email ?? null;
          const buyerName = session.customer_details?.name ?? null;

          console.log('[ArtworkSale] Webhook: artwork purchase completed', {
            artworkId,
            sessionId: session.id,
          });

          try {
            // Mark artwork as sold
            const { error: updateErr } = await asUntyped(admin)
              .from('artworks')
              .update({ sold_at: new Date().toISOString() })
              .eq('id', artworkId);

            if (updateErr) {
              console.error('[ArtworkSale] Webhook: failed to mark artwork sold', updateErr);
            }

            // Record purchase in artwork_inquiries
            const { error: inquiryErr } = await asUntyped(admin)
              .from('artwork_inquiries')
              .insert({
                artwork_id: artworkId,
                owner_account_id: ownerAccountId,
                name: buyerName ?? buyerEmail ?? 'Unknown buyer',
                email: buyerEmail ?? '',
                inquiry_type: 'purchase',
                stripe_session_id: session.id,
                status: 'sold',
              });

            if (inquiryErr) {
              console.error('[ArtworkSale] Webhook: failed to insert purchase inquiry', inquiryErr);
            }

            // Capture buyer in owner's CRM (best-effort)
            if (buyerEmail) {
              try {
                await captureCrmContacts(ownerAccountId, [
                  {
                    email: buyerEmail,
                    name: buyerName ?? undefined,
                    source: 'artwork_purchase',
                  },
                ]);
              } catch (crmErr) {
                console.error('[ArtworkSale] Webhook: CRM capture failed (non-fatal)', crmErr);
              }
            }

            console.log('[ArtworkSale] Artwork sold via Stripe session', {
              artworkId,
              sessionId: session.id,
            });
          } catch (fulfillErr) {
            console.error('[ArtworkSale] Webhook: artwork purchase fulfillment threw', fulfillErr);
          }

          return NextResponse.json({ received: true });
        }

        // Reconcile subscription checkout immediately so the success page never shows stale state.
        if (session.mode !== 'subscription' || !session.subscription) {
          return NextResponse.json({ received: true });
        }
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        // Subscription metadata may be empty here if checkout didn't pass it
        // through; merge from session.metadata as a backup so the resolver can
        // find user_id/role.
        if (session.metadata?.user_id && !subscription.metadata?.user_id) {
          subscription.metadata = {
            ...(subscription.metadata ?? {}),
            user_id: session.metadata.user_id,
            role: session.metadata.role ?? subscription.metadata?.role ?? '',
          };
        }
        const result = await upsertFromSubscription(admin, subscription);
        if (!result.ok) {
          return NextResponse.json({ received: true, error: result.reason });
        }
        return NextResponse.json({ received: true });
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        // Redundant safety net beside customer.subscription.updated. If either
        // arrives, we keep current_period_end fresh and the user keeps access.
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        if (!invoice.subscription) {
          return NextResponse.json({ received: true });
        }
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        const result = await upsertFromSubscription(admin, subscription);
        if (!result.ok) {
          return NextResponse.json({ received: true, error: result.reason });
        }
        console.log('[Stripe] Renewal synced from invoice', {
          subscriptionId: subscription.id,
          currentPeriodEnd: subscription.current_period_end,
        });
        return NextResponse.json({ received: true });
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        if (!invoice.subscription) {
          return NextResponse.json({ received: true });
        }
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        // Mirror the latest status (Stripe will mark past_due/unpaid).
        const result = await upsertFromSubscription(admin, subscription);
        if (!result.ok) {
          return NextResponse.json({ received: true, error: result.reason });
        }
        // Notify the user in-app.
        const resolved = await resolveUserAndRole(admin, subscription);
        if (resolved) {
          const { error: notifErr } = await asUntyped(admin)
            .from('notifications')
            .insert({
              user_id: resolved.userId,
              type: 'subscription_payment_failed',
              title: 'Payment failed',
              message:
                'Your latest payment did not go through. Update your card to keep access.',
              metadata: {
                subscription_id: subscription.id,
                attempt_count: invoice.attempt_count ?? null,
              },
            });
          if (notifErr) {
            console.error('[Stripe] payment_failed notification insert failed', notifErr);
          }
        }
        console.error('[Stripe] Renewal payment failed', {
          subscriptionId: subscription.id,
          customer: subscription.customer,
          attemptCount: invoice.attempt_count,
        });
        return NextResponse.json({ received: true });
      }

      default:
        console.log('[Stripe] Webhook ignored event', { type: event.type });
        return NextResponse.json({ received: true });
    }
  } catch (err) {
    console.error('[Stripe] Webhook: handler threw', { type: event.type, err });
    return NextResponse.json(
      { error: 'Failed to handle webhook' },
      { status: 500 },
    );
  }
}
