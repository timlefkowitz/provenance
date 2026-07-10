'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Un-share a grant the user previously shared with the community.
 * Only the original sharer can un-share.
 */
export async function unshareGrant(grantId: string) {
  console.log('[Grants] unshareGrant', grantId);
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Grants] unshareGrant: not authenticated', authError);
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await asUntyped(client)
    .from('artist_grants')
    .update({
      is_community: false,
      shared_by: null,
      shared_by_name: null,
    })
    .eq('id', grantId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Grants] unshareGrant failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Grants] unshareGrant success', grantId);
  return { success: true };
}
