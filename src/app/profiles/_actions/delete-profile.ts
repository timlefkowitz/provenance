'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getExhibitionsForGallery } from '~/app/exhibitions/_actions/get-exhibitions';

/**
 * Delete a role profile
 */
export async function deleteProfile(profileId: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to delete a profile' };
    }

    // Verify the profile belongs to the user and get role
    const { data: profile, error: fetchError } = await client
      .from('user_profiles')
      .select('user_id, role')
      .eq('id', profileId)
      .single();

    if (fetchError || !profile) {
      return { error: 'Profile not found' };
    }

    if (profile.user_id !== user.id) {
      return { error: 'You do not have permission to delete this profile' };
    }

    // For gallery profiles, check if there are exhibitions
    // Note: Exhibitions are linked to gallery_id (account ID), not profile ID
    // So deleting a gallery profile won't delete exhibitions, but we should warn
    if (profile.role === 'gallery') {
      const exhibitions = await getExhibitionsForGallery(profile.user_id);
      if (exhibitions.length > 0) {
        // Note: Exhibitions will remain, but the profile will be deleted
        // The exhibitions are tied to the account, not the specific profile
        // This is informational - we'll still allow deletion
      }
    }

    // Delete the profile
    const { error } = await client
      .from('user_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      console.error('Error deleting profile:', error);
      return { error: error.message || 'Failed to delete profile' };
    }

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/artists/${profile.user_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

