'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

export type DeleteSiteResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Delete the profile_sites row for a given profile.
 * Caller must own or manage that profile.
 */
export async function deleteSiteAction(profileId: string): Promise<DeleteSiteResult> {
  console.log('[Sites] deleteSiteAction', { profileId });

  const client = getSupabaseServerClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const sb = client as any;
  const { data: profile } = await sb
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }

  let hasAccess = profile.user_id === user.id;
  if (!hasAccess && profile.role === 'gallery') {
    hasAccess = await canManageGallery(user.id, profileId);
  }
  if (!hasAccess) {
    return { success: false, error: 'You do not have permission to delete this site' };
  }

  const { error: delErr } = await sb
    .from('profile_sites')
    .delete()
    .eq('profile_id', profileId);

  if (delErr) {
    console.error('[Sites] deleteSiteAction failed', delErr);
    return { success: false, error: delErr.message };
  }

  console.log('[Sites] deleteSiteAction succeeded', { profileId });
  return { success: true };
}
