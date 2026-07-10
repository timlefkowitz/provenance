'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Toggle the bookmarked state of a grant. RLS ensures only the owner can update.
 */
export async function toggleGrantBookmark(
  grantId: string,
  bookmarked: boolean,
): Promise<{ success: boolean; error: string | null }> {
  console.log('[Grants] toggleGrantBookmark', { grantId, bookmarked });

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await asUntyped(client)
    .from('artist_grants')
    .update({ bookmarked })
    .eq('id', grantId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Grants] toggleGrantBookmark failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Grants] toggleGrantBookmark succeeded');
  return { success: true, error: null };
}
