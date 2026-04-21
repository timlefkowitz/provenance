'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';

const FREE_ROLES = ['artist', 'collector', 'gallery', 'institution'] as const;
export type GrantFreeAccessRole = (typeof FREE_ROLES)[number];

const ALLOWED_DURATIONS = new Set([0, 30, 90, 365]);

export async function grantFreeAccess(params: {
  userId: string;
  role: string;
  /** 0 = no end date (permanent); otherwise days from now */
  durationDays: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[AdminUserAccess] grantFreeAccess started', {
    userId: params.userId,
    role: params.role,
    durationDays: params.durationDays,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    console.error('[AdminUserAccess] grantFreeAccess unauthorized');
    return { ok: false, error: 'Unauthorized' };
  }

  const role = params.role as GrantFreeAccessRole;
  if (!FREE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role' };
  }

  if (!ALLOWED_DURATIONS.has(params.durationDays)) {
    return { ok: false, error: 'Invalid duration' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const endIso =
    params.durationDays === 0
      ? null
      : new Date(
          now.getTime() + params.durationDays * 24 * 60 * 60 * 1000,
        ).toISOString();

  const stripeSubscriptionId = `free_${params.userId}_${Date.now()}`;

  const admin = getSupabaseServerAdminClient();
  const { error } = await (admin as any).from('subscriptions').insert({
    user_id: params.userId,
    stripe_customer_id: null,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: null,
    status: 'active',
    current_period_end: endIso,
    trial_end: null,
    role,
    updated_at: nowIso,
  });

  if (error) {
    console.error('[AdminUserAccess] grantFreeAccess failed', error);
    return { ok: false, error: error.message };
  }

  console.log('[AdminUserAccess] grantFreeAccess completed', {
    userId: params.userId,
  });
  revalidatePath('/admin/users');
  return { ok: true };
}
