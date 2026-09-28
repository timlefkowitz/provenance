/**
 * Creates a pre-confirmed Apple App Review account whose subscription has
 * already expired, so the reviewer can walk the full purchase flow
 * (App Review guideline 2.1 — "demo account with an expired subscription").
 *
 * Like create-app-review-account.ts, this uses the Supabase Admin API so the
 * on_auth_user_created trigger creates the public.accounts row. It then sets
 * the account role and inserts a lapsed Apple IAP subscriptions row
 * (status 'canceled', current_period_end in the past) — the same shape the
 * App Store webhook leaves behind after an EXPIRED notification. The
 * subscription page and getActiveSubscription both treat it as no active
 * plan, so the reviewer lands on the paywall and can buy via StoreKit sandbox.
 *
 * The apple_original_transaction_id is a synthetic `demo-` value that no real
 * Apple notification will ever match, so a sandbox purchase by the reviewer
 * creates its own row instead of mutating this one.
 *
 * After this runs, sign in as the account once through the app to finish any
 * remaining onboarding and add 2-3 sample items so it isn't an empty state.
 *
 * Usage:
 *   REVIEW_ACCOUNT_PASSWORD='<password>' pnpm with-env tsx scripts/create-app-review-expired-account.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVIEW_ACCOUNT_PASSWORD  (set this on the command line, never commit it)
 */

import { createClient } from '@supabase/supabase-js';

const REVIEW_ACCOUNT_EMAIL = 'appreview-expired@provenance.guru';
const REVIEW_ACCOUNT_ROLE = 'collector';
const DEMO_TRANSACTION_ID = 'demo-app-review-expired';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.REVIEW_ACCOUNT_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  if (!password || password.length < 12) {
    throw new Error(
      'Set REVIEW_ACCOUNT_PASSWORD to a password of at least 12 characters before running this script.',
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: REVIEW_ACCOUNT_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'App Review (Expired)' },
  });
  if (error) throw error;
  const userId = data.user.id;

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .single();
  if (accountError) throw accountError;

  const { error: roleError } = await supabase
    .from('accounts')
    .update({
      public_data: {
        ...((account?.public_data as Record<string, unknown> | null) ?? {}),
        role: REVIEW_ACCOUNT_ROLE,
        // Keep the demo account out of /registry and the public feed.
        hidden_from_directory: true,
      },
    })
    .eq('id', userId);
  if (roleError) throw roleError;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const { error: subError } = await supabase.from('subscriptions').insert({
    user_id: userId,
    provider: 'apple_iap',
    revenuecat_subscriber_id: userId,
    apple_original_transaction_id: DEMO_TRANSACTION_ID,
    role: REVIEW_ACCOUNT_ROLE,
    status: 'canceled',
    current_period_end: new Date(now - 7 * day).toISOString(),
    created_at: new Date(now - 37 * day).toISOString(),
    updated_at: new Date(now - 7 * day).toISOString(),
  });
  if (subError) throw subError;

  console.log(`Created expired-subscription review account: ${data.user.email} (id: ${userId})`);
  console.log('Next: sign in through the app, finish onboarding, and add 2-3 sample items.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
