'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { redirect } from 'next/navigation';

/**
 * Permanently deletes the current user's account.
 *
 * Steps:
 *   1. Verify the user is authenticated.
 *   2. Cancel any active subscriptions (soft-cancel in our DB; Stripe/Apple
 *      will handle the actual billing side via their own portals).
 *   3. Anonymise or cascade-delete user data (artworks, profiles, etc. are
 *      covered by ON DELETE CASCADE on auth.users; sensitive PII columns are
 *      cleared explicitly).
 *   4. Delete the Supabase auth user — this cascades to all tables that
 *      reference auth.users(id) with ON DELETE CASCADE.
 *
 * Apple Guideline 5.1.1(v) requires this be available inside the native app.
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  console.log('[Settings] deleteAccount started');

  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      console.error('[Settings] deleteAccount: unauthenticated', authError);
      return { success: false, error: 'unauthenticated' };
    }

    const admin = asUntyped(getSupabaseServerAdminClient());

    // 1. Cancel any active subscription rows in our DB.
    const { error: subErr } = await admin
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due']);

    if (subErr) {
      console.error('[Settings] deleteAccount: failed to cancel subscriptions', subErr);
      // Non-fatal — continue with deletion.
    }

    // 2. Anonymise the account display name and picture so any cached references
    //    no longer expose PII. (All other data is cascade-deleted in step 3.)
    const { error: accountErr } = await admin
      .from('accounts')
      .update({
        name: 'Deleted User',
        email: `deleted-${user.id}@provenance.invalid`,
        picture_url: null,
        public_data: {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (accountErr) {
      console.error('[Settings] deleteAccount: failed to anonymise account', accountErr);
      // Non-fatal — the auth user deletion below will cascade-delete this row anyway.
    }

    // 3. Delete the Supabase auth user. All tables with:
    //      REFERENCES auth.users(id) ON DELETE CASCADE
    //    (artworks, profiles, subscriptions, stripe_customers, etc.) are
    //    automatically cleaned up by the database.
    const { error: deleteErr } = await getSupabaseServerAdminClient().auth.admin.deleteUser(user.id);

    if (deleteErr) {
      console.error('[Settings] deleteAccount: auth.admin.deleteUser failed', deleteErr);
      return { success: false, error: deleteErr.message };
    }

    console.log('[Settings] deleteAccount: account deleted', { userId: user.id });
    return { success: true };
  } catch (err) {
    console.error('[Settings] deleteAccount threw', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server action wrapper used by the UI that also signs the user out and
 * redirects to the home page after successful deletion.
 */
export async function deleteAccountAndRedirect(): Promise<void> {
  const result = await deleteAccount();
  if (result.success) {
    redirect('/');
  }
  // If it fails, the client receives the error via the action's return type,
  // but redirect() throws a special Next.js error so we can't return here.
  // The calling component should check result.success before calling this.
}
