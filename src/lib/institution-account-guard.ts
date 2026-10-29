import 'server-only';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canAccountActAs, INSTITUTION_LOCK_MESSAGE } from '~/lib/institution-account';

/**
 * Server-side check before an action posts or claims in a given role.
 * Returns an error message when a locked institution account tries to act as
 * anything but the institution, otherwise null.
 */
export async function getInstitutionLockError(
  userId: string,
  role: string | null | undefined,
): Promise<string | null> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .maybeSingle();

  const publicData = account?.public_data as Record<string, unknown> | null | undefined;
  if (canAccountActAs(publicData, role)) return null;

  console.log('[InstitutionLock] blocked action', { userId, role });
  return INSTITUTION_LOCK_MESSAGE;
}
