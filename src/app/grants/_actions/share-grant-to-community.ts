'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';

/**
 * Share a user-owned grant with the community (visible to all artists).
 * Only the grant owner can share their own grants.
 */
export async function shareGrantToCommunity(grantId: string) {
  console.log('[Grants] shareGrantToCommunity', grantId);
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Grants] shareGrantToCommunity: not authenticated', authError);
    return { success: false, error: 'Not authenticated' };
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
  const sharedByName = artistProfile?.name ?? 'An artist';

  const { error } = await (client as any)
    .from('artist_grants')
    .update({
      is_community: true,
      shared_by: user.id,
      shared_by_name: sharedByName,
    })
    .eq('id', grantId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Grants] shareGrantToCommunity failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Grants] shareGrantToCommunity success', grantId);
  return { success: true };
}
