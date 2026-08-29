/**
 * Creates a pre-confirmed account for Apple App Review.
 *
 * Uses the Supabase Admin API (not a raw SQL insert into auth.users) so the
 * password hash format is correct, the auth.identities row is populated, and
 * the on_auth_user_created trigger fires to create the matching
 * public.accounts row.
 *
 * After this runs, sign in as the account once through the app to complete
 * onboarding (pick a profile type) and add 2-3 sample artworks/collectibles
 * so the reviewer doesn't land on an empty state.
 *
 * Usage:
 *   REVIEW_ACCOUNT_PASSWORD='<password>' pnpm with-env tsx scripts/create-app-review-account.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVIEW_ACCOUNT_PASSWORD  (set this on the command line, never commit it)
 */

import { createClient } from '@supabase/supabase-js';

const REVIEW_ACCOUNT_EMAIL = 'appreview@provenance.guru';

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
    user_metadata: { full_name: 'App Review' },
  });

  if (error) {
    throw error;
  }

  console.log(`Created review account: ${data.user.email} (id: ${data.user.id})`);
  console.log('Next: sign in through the app, complete onboarding, and add 2-3 sample items.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
