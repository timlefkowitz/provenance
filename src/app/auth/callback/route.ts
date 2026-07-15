import { asUntyped } from '~/lib/supabase-untyped';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendWelcomeEmail } from '~/lib/email';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';


export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(getSupabaseServerClient());
  const client = asUntyped(getSupabaseServerClient());

  const { nextPath } = await service.exchangeCodeForSession(request, {
    // Default post-sign-in destination — moved from `/portal` to `/artworks`
    // so users land directly in their collection.
    redirectPath: '/artworks',
  });

  // Track whether this is a brand-new account so we can signal GTM on the client.
  let isNewUser = false;

  // After exchanging the code, we can safely read the authenticated user
  // and provision a 14-day free trial entitlement for subscription-gated features.
  try {
    const { data: { user } } = await client.auth.getUser();

    if (user) {
      const { data: account } = await client
        .from('accounts')
        .select('email, name, created_at, public_data')
        .eq('id', user.id)
        .single();

      const accountRole = getUserRole((account?.public_data as Record<string, unknown> | null) ?? null);
      const role = accountRole ?? USER_ROLES.ARTIST;

      const now = new Date();
      const nowIso = now.toISOString();
      const trialDays = 14;
      const trialEndIso = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      const trialStripeSubscriptionId = `trial_${user.id}`;

      try {
        console.log('[Billing] trial provisioning started', { userId: user.id });

        const admin = asUntyped(getSupabaseServerAdminClient());

        const { data: eligibleSubscriptionRows } = await asUntyped(admin)
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .or(`current_period_end.is.null,current_period_end.gte.${nowIso}`)
          .limit(1);

        const hasEligibleSubscription = (eligibleSubscriptionRows?.length ?? 0) > 0;

        // If we already created our idempotent trial row (even if it expired),
        // do not extend or recreate it.
        const { data: existingTrialRows } = await asUntyped(admin)
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', trialStripeSubscriptionId)
          .limit(1);

        const hasExistingTrialRow = (existingTrialRows?.length ?? 0) > 0;

        if (!hasEligibleSubscription && !hasExistingTrialRow) {
          await asUntyped(admin).from('subscriptions').insert({
            user_id: user.id,
            stripe_customer_id: null,
            stripe_subscription_id: trialStripeSubscriptionId,
            stripe_price_id: null,
            status: 'trialing',
            current_period_end: trialEndIso,
            trial_end: trialEndIso,
            role,
            updated_at: nowIso,
          });
          console.log('[Billing] trial provisioned', { userId: user.id });
        } else {
          console.log('[Billing] trial provisioning skipped', {
            userId: user.id,
            hasEligibleSubscription,
            hasExistingTrialRow,
          });
        }
      } catch (trialErr) {
        // Never block sign-in redirect on provisioning failures.
        console.error('[Billing] trial provisioning failed', trialErr);
      }

      // Check if this is a new user and send welcome email
      try {
        if (account?.email && account.created_at) {
          const createdAt = new Date(account.created_at);
          const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

          // If account was created in the last 2 minutes, treat as new user
          if (minutesSinceCreation < 2) {
            isNewUser = true;
            const userName = account.name || account.email.split('@')[0] || 'there';

            // Send email asynchronously (don't block the redirect)
            sendWelcomeEmail(account.email, userName).catch((error) => {
              console.error('Failed to send welcome email:', error);
              // Don't fail the auth flow if email fails
            });
          }
        }
      } catch (emailErr) {
        // Don't fail the auth flow if email check/sending fails
        console.error('Error checking/sending welcome email:', emailErr);
      }
    }
  } catch (error) {
    // Don't fail the auth flow if anything above fails
    console.error('Error provisioning trial/welcome email in auth callback:', error);
  }

  // Always use the request origin to ensure we redirect to the correct domain
  // Extract just the pathname if nextPath contains a full URL (e.g., from Supabase redirect)
  const origin = request.nextUrl.origin;
  let pathToRedirect = nextPath;
  
  // If nextPath is a full URL, extract just the pathname
  try {
    const url = new URL(nextPath);
    pathToRedirect = url.pathname + url.search;
  } catch {
    // nextPath is already just a path, use it as-is
    pathToRedirect = nextPath;
  }

  // Guard against open redirects (CASA 5.1.2 / CWE-601): the `next` param on this
  // route comes straight from the query string via @kit/supabase's auth callback
  // service. The block above strips the host from full absolute URLs
  // (e.g. `https://evil.com/x` -> `/x`), but protocol-relative URLs like
  // `//evil.com/x` fail the `new URL(nextPath)` parse (no base), fall into the
  // catch, and are used as-is. `new URL('//evil.com/x', origin)` then resolves
  // to `https://evil.com/x` because a leading `//` is a network-path reference
  // that takes over the host from `origin`. Reject anything that isn't a
  // same-origin, single-leading-slash path before building the redirect.
  if (!pathToRedirect.startsWith('/') || pathToRedirect.startsWith('//') || pathToRedirect.startsWith('/\\')) {
    console.warn('[Auth] Rejected unsafe post-login redirect target', { nextPath });
    pathToRedirect = '/artworks';
  }

  const redirectUrl = new URL(pathToRedirect, origin);

  if (isNewUser) {
    redirectUrl.searchParams.set('new_user', '1');
    console.log('[GTM] New user detected — appending ?new_user=1 to redirect');
  }

  return NextResponse.redirect(redirectUrl);
}
