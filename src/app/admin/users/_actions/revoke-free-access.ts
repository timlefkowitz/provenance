'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';

/**
 * Revoke a single admin-granted free row (stripe_subscription_id starts with `free_`).
 */
export async function revokeFreeAccess(
  subscriptionRowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[AdminUserAccess] revokeFreeAccess started', { subscriptionRowId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    console.error('[AdminUserAccess] revokeFreeAccess unauthorized');
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = getSupabaseServerAdminClient();
  const { data: row, error: fetchErr } = await (admin as any)
    .from('subscriptions')
    .select('id, stripe_subscription_id')
    .eq('id', subscriptionRowId)
    .single();

  if (fetchErr || !row) {
    console.error('[AdminUserAccess] revoke fetch failed', fetchErr);
    return { ok: false, error: 'Subscription not found' };
  }

  const sid = row.stripe_subscription_id as string | null;
  if (!sid || !sid.startsWith('free_')) {
    return { ok: false, error: 'Not a free-access grant' };
  }

  const { error: updErr } = await (admin as any)
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionRowId);

  if (updErr) {
    console.error('[AdminUserAccess] revoke failed', updErr);
    return { ok: false, error: updErr.message };
  }

  console.log('[AdminUserAccess] revokeFreeAccess completed');
  revalidatePath('/admin/users');
  return { ok: true };
}
