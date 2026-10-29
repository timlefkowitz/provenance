'use server';

import { revalidatePath } from 'next/cache';
import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { requireAdminUserId } from '~/lib/admin';
import { INSTITUTION_ACCOUNT_TYPE } from '~/lib/institution-account';
import { USER_ROLES } from '~/lib/user-roles';

/**
 * Lock (or unlock) an account as an institution account. Admin only.
 * Locking also switches the account into institution mode. Runs with the
 * service role, the only role the account-type trigger lets change it.
 */
export async function setInstitutionAccount(params: {
  userId: string;
  locked: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[AdminUserAccess] setInstitutionAccount started', params);

  const adminId = await requireAdminUserId();
  if (!adminId) {
    console.error('[AdminUserAccess] setInstitutionAccount unauthorized');
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: account, error: loadError } = await admin
    .from('accounts')
    .select('public_data')
    .eq('id', params.userId)
    .single();

  if (loadError || !account) {
    console.error('[AdminUserAccess] setInstitutionAccount account load failed', loadError);
    return { ok: false, error: 'Account not found' };
  }

  const publicData = { ...((account.public_data as Record<string, unknown>) || {}) };
  if (params.locked) {
    publicData.account_type = INSTITUTION_ACCOUNT_TYPE;
    publicData.role = USER_ROLES.INSTITUTION;
  } else {
    delete publicData.account_type;
  }

  const { error } = await admin
    .from('accounts')
    .update({ public_data: publicData })
    .eq('id', params.userId);

  if (error) {
    console.error('[AdminUserAccess] setInstitutionAccount failed', error);
    return { ok: false, error: error.message };
  }

  console.log('[AdminUserAccess] setInstitutionAccount completed', params);
  revalidatePath('/admin/users');
  revalidatePath('/', 'layout');
  return { ok: true };
}
