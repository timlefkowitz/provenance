'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';

export type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
  role: string;
  current_period_end: string | null;
  trial_end: string | null;
  updated_at: string;
};

export type AdminUserSearchHit = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptions: AdminSubscriptionRow[];
};

function escapeIlikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Search accounts by email (partial match, case-insensitive). Admin only.
 */
export async function searchUserByEmailForAdmin(
  email: string,
): Promise<
  { ok: true; users: AdminUserSearchHit[] } | { ok: false; error: string }
> {
  console.log('[AdminUserAccess] searchUserByEmailForAdmin started');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    console.error('[AdminUserAccess] search unauthorized');
    return { ok: false, error: 'Unauthorized' };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: 'Email is required' };
  }

  const admin = getSupabaseServerAdminClient();
  const pattern = `%${escapeIlikePattern(trimmed)}%`;

  const { data: accounts, error: accErr } = await admin
    .from('accounts')
    .select('id, email, name')
    .ilike('email', pattern)
    .limit(20);

  if (accErr) {
    console.error('[AdminUserAccess] search failed', accErr);
    return { ok: false, error: 'Search failed' };
  }

  if (!accounts?.length) {
    console.log('[AdminUserAccess] search completed', { count: 0 });
    return { ok: true, users: [] };
  }

  const users: AdminUserSearchHit[] = [];
  for (const acc of accounts) {
    const { data: subs, error: subErr } = await admin
      .from('subscriptions')
      .select(
        'id, user_id, stripe_subscription_id, status, role, current_period_end, trial_end, updated_at',
      )
      .eq('user_id', acc.id)
      .order('updated_at', { ascending: false });

    if (subErr) {
      console.error('[AdminUserAccess] subscriptions load failed', subErr);
      return { ok: false, error: 'Failed to load subscriptions' };
    }

    users.push({
      id: acc.id,
      email: acc.email,
      name: acc.name,
      subscriptions: (subs ?? []) as AdminSubscriptionRow[],
    });
  }

  console.log('[AdminUserAccess] search completed', { count: users.length });
  return { ok: true, users };
}
