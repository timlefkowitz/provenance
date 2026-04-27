/* eslint-disable @typescript-eslint/no-explicit-any -- subscriptions table not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

/**
 * Daily safety-net cron for Stripe billing.
 *
 * 1. RECONCILE: For every real Stripe subscription in our DB whose period is
 *    expiring soon or whose status looks unhealthy, fetch the live subscription
 *    from Stripe and refresh status / current_period_end. This catches any
 *    webhook miss so paying customers don't get locked out incorrectly.
 *
 * 2. TRIAL WARNINGS: For every local trial row (stripe_subscription_id LIKE
 *    'trial_%') still trialing, emit in-app notifications at T-3 / T-1 / T-0
 *    days before trial expiry. Deduped per (subscription, day-bucket) via
 *    metadata so we don't spam.
 *
 * Auth: protected by CRON_SECRET (Authorization: Bearer ...).
 */

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/stripe-reconcile] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  return header.slice(7) === secret;
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string' || !key.trim().startsWith('sk')) return null;
  return new Stripe(key.trim());
}

const ALLOWED_STATUSES = new Set([
  'active',
  'canceled',
  'past_due',
  'unpaid',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

function dayBucket(daysUntil: number): '3' | '1' | '0' | null {
  if (daysUntil <= 0) return '0';
  if (daysUntil === 1) return '1';
  if (daysUntil <= 3 && daysUntil >= 2) return '3';
  return null;
}

export async function POST(request: NextRequest) {
  return run(request);
}

// Vercel Cron triggers via GET by default.
export async function GET(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON/stripe-reconcile] started');
  const admin = getSupabaseServerAdminClient() as any;
  const stripe = getStripe();

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  let renewalChecked = 0;
  let renewalDrifted = 0;
  let renewalErrors = 0;
  let trialNotifsCreated = 0;
  let trialNotifsSkipped = 0;

  // ---------------------------------------------------------------
  // 1. Reconcile real Stripe subscriptions
  // ---------------------------------------------------------------
  if (stripe) {
    const { data: dueSubs, error: dueErr } = await admin
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, current_period_end')
      .not('stripe_subscription_id', 'is', null)
      .not('stripe_subscription_id', 'like', 'trial_%')
      .not('stripe_subscription_id', 'like', 'free_%')
      .or(
        `current_period_end.lte.${in48h.toISOString()},status.in.(past_due,unpaid,incomplete,paused)`,
      );

    if (dueErr) {
      console.error('[CRON/stripe-reconcile] subscriptions load failed', dueErr);
    } else {
      for (const row of dueSubs ?? []) {
        renewalChecked += 1;
        const subId = row.stripe_subscription_id as string;
        try {
          const live = await stripe.subscriptions.retrieve(subId);
          const liveStatus = ALLOWED_STATUSES.has(live.status) ? live.status : 'canceled';
          const liveEnd = live.current_period_end
            ? new Date(live.current_period_end * 1000).toISOString()
            : null;

          const drifted =
            liveStatus !== row.status || liveEnd !== row.current_period_end;
          if (drifted) {
            renewalDrifted += 1;
            const { error: updErr } = await admin
              .from('subscriptions')
              .update({
                status: liveStatus,
                current_period_end: liveEnd,
                stripe_price_id: live.items?.data?.[0]?.price?.id ?? null,
                trial_end: live.trial_end
                  ? new Date(live.trial_end * 1000).toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            if (updErr) {
              renewalErrors += 1;
              console.error('[CRON/stripe-reconcile] update failed', {
                subId,
                updErr,
              });
            } else {
              console.log('[CRON/stripe-reconcile] drift corrected', {
                subId,
                from: { status: row.status, end: row.current_period_end },
                to: { status: liveStatus, end: liveEnd },
              });
            }
          }
        } catch (err) {
          renewalErrors += 1;
          console.error('[CRON/stripe-reconcile] stripe.retrieve failed', {
            subId,
            err,
          });
        }
      }
    }
  } else {
    console.error('[CRON/stripe-reconcile] STRIPE_SECRET_KEY missing — skipping reconcile');
  }

  // ---------------------------------------------------------------
  // 2. Trial expiry warnings
  // ---------------------------------------------------------------
  const { data: trialSubs, error: trialErr } = await admin
    .from('subscriptions')
    .select('id, user_id, stripe_subscription_id, current_period_end, status')
    .eq('status', 'trialing')
    .like('stripe_subscription_id', 'trial_%');

  if (trialErr) {
    console.error('[CRON/stripe-reconcile] trial subs load failed', trialErr);
  } else {
    for (const row of trialSubs ?? []) {
      if (!row.current_period_end) continue;
      const end = new Date(row.current_period_end);
      const daysUntil = Math.ceil(
        (end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      const bucket = dayBucket(daysUntil);
      if (!bucket) continue;

      // Dedupe — has a notification for this subscription + bucket already
      // been inserted? We use metadata->>'trial_warning_day' to track.
      const { data: prior } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', row.user_id)
        .eq('type', 'trial_expiring')
        .contains('metadata', {
          subscription_id: row.stripe_subscription_id,
          trial_warning_day: bucket,
        })
        .limit(1);

      if (prior && prior.length > 0) {
        trialNotifsSkipped += 1;
        continue;
      }

      const message =
        bucket === '0'
          ? 'Your trial ends today. Subscribe now to keep your access.'
          : bucket === '1'
            ? 'Your trial ends tomorrow. Subscribe now to keep your access.'
            : `Your trial ends in ${daysUntil} days. Subscribe to keep your access.`;

      const { error: insErr } = await admin.from('notifications').insert({
        user_id: row.user_id,
        type: 'trial_expiring',
        title: 'Trial ending soon',
        message,
        metadata: {
          subscription_id: row.stripe_subscription_id,
          trial_warning_day: bucket,
          current_period_end: row.current_period_end,
        },
      });
      if (insErr) {
        console.error('[CRON/stripe-reconcile] trial notification insert failed', {
          userId: row.user_id,
          insErr,
        });
      } else {
        trialNotifsCreated += 1;
      }
    }
  }

  const summary = {
    renewalChecked,
    renewalDrifted,
    renewalErrors,
    trialNotifsCreated,
    trialNotifsSkipped,
  };
  console.log('[CRON/stripe-reconcile] done', summary);
  return NextResponse.json({ ok: true, ...summary });
}
