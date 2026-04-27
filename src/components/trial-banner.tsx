import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { TrialBannerClient } from './trial-banner-client';

/**
 * Server component: renders a dismissible parchment banner when the current
 * user is on the local 14-day signup trial and has 3 days or fewer remaining.
 * Returns null otherwise. The banner links to /subscription.
 *
 * Real Stripe trials (status = 'trialing' but stripe_subscription_id starts
 * with 'sub_') are excluded — Stripe will charge them automatically.
 */
export async function TrialBanner() {
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;

    const { data: rows } = await (client as any)
      .from('subscriptions')
      .select('id, status, stripe_subscription_id, current_period_end')
      .eq('user_id', user.id)
      .eq('status', 'trialing')
      .like('stripe_subscription_id', 'trial_%')
      .order('current_period_end', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row?.current_period_end) return null;

    const end = new Date(row.current_period_end as string);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntil = Math.ceil((end.getTime() - now.getTime()) / msPerDay);

    if (daysUntil > 3) return null;

    const dismissKey = `trial_banner_dismissed_${row.id}`;
    const message =
      daysUntil <= 0
        ? 'Your trial ends today.'
        : daysUntil === 1
          ? 'Your trial ends tomorrow.'
          : `Your trial ends in ${daysUntil} days.`;

    return (
      <TrialBannerClient dismissKey={dismissKey}>
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-wine/10 border-b border-wine/30 text-sm font-serif text-ink">
          <p className="flex-1">
            <span className="font-semibold text-wine">{message}</span>{' '}
            Subscribe now to keep your access.
          </p>
          <Link
            href="/subscription"
            className="shrink-0 inline-flex items-center px-3 py-1 rounded bg-wine text-parchment hover:bg-wine/90 text-xs font-semibold tracking-wide"
          >
            Subscribe
          </Link>
        </div>
      </TrialBannerClient>
    );
  } catch (err) {
    console.error('[TrialBanner] render failed', err);
    return null;
  }
}
