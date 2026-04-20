'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

/**
 * Soft-delete a role profile by marking it inactive.
 *
 * We deliberately avoid hard-deleting the row because several tables
 * (open_calls, gallery_members) have ON DELETE CASCADE foreign keys that
 * would silently destroy real user data. A soft delete removes the profile
 * from every UI query (all queries filter is_active = true) while keeping
 * all linked records — exhibitions, artworks, open calls — intact.
 */
export async function deleteProfile(profileId: string) {
  console.log('[deleteProfile] Soft-deleting profile', profileId);
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to remove a profile' };
    }

    // Verify ownership
    const { data: profile, error: fetchError } = await client
      .from('user_profiles')
      .select('user_id, role, name')
      .eq('id', profileId)
      .single();

    if (fetchError || !profile) {
      return { error: 'Profile not found' };
    }

    if (profile.user_id !== user.id) {
      return { error: 'You do not have permission to remove this profile' };
    }

    // Soft delete: set is_active = false so every UI query (which filters
    // is_active = true) stops seeing this profile, but no linked data is lost.
    const { error } = await client
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', profileId);

    if (error) {
      console.error('[deleteProfile] Supabase update failed', error);
      return { error: error.message || 'Failed to remove profile' };
    }

    console.log('[deleteProfile] Profile deactivated successfully', { profileId, role: profile.role });

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/artists/${profile.user_id}`);

    return { success: true };
  } catch (err) {
    console.error('[deleteProfile] Unexpected error', err);
    return { error: 'An unexpected error occurred' };
  }
}
