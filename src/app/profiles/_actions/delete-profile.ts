'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

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

    // Verify the profile belongs to the user
    const { data: profile, error: fetchError } = await client
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();

    if (fetchError || !profile) {
      return { error: 'Profile not found' };
    }

    if (profile.user_id !== user.id) {
      return { error: 'You do not have permission to delete this profile' };
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

    return { success: true };
  } catch (error) {
    console.error('Error in deleteProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

