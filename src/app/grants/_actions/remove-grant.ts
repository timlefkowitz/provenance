'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Delete a grant from the user's list. Only works on user-owned rows (not
 * curated grants where user_id IS NULL). RLS enforces ownership.
 */
export async function removeGrant(
  grantId: string,
): Promise<{ success: boolean; error: string | null }> {
  console.log('[Grants] removeGrant', { grantId });

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await (client as any)
    .from('artist_grants')
    .delete()
    .eq('id', grantId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Grants] removeGrant failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Grants] removeGrant succeeded');
  return { success: true, error: null };
}
