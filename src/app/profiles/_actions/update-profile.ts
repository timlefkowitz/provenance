'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { isValidRole, type UserRole } from '~/lib/user-roles';

export interface UpdateProfileInput {
  profileId: string;
  name?: string;
  picture_url?: string;
  bio?: string;
  medium?: string;
  location?: string;
  website?: string;
  links?: string[];
  galleries?: string[];
  contact_email?: string;
  phone?: string;
  is_active?: boolean;
}

/**
 * Update an existing role profile
 */
export async function updateProfile(input: UpdateProfileInput) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update a profile' };
    }

    // Verify the profile belongs to the user
    const { data: profile, error: fetchError } = await client
      .from('user_profiles')
      .select('user_id, role')
      .eq('id', input.profileId)
      .single();

    if (fetchError || !profile) {
      return { error: 'Profile not found' };
    }

    if (profile.user_id !== user.id) {
      return { error: 'You do not have permission to update this profile' };
    }

    // Build update object
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.picture_url !== undefined) updateData.picture_url = input.picture_url || null;
    if (input.bio !== undefined) updateData.bio = input.bio?.trim() || null;
    if (input.medium !== undefined) updateData.medium = input.medium?.trim() || null;
    if (input.location !== undefined) updateData.location = input.location?.trim() || null;
    if (input.website !== undefined) updateData.website = input.website?.trim() || null;
    if (input.links !== undefined) updateData.links = input.links || [];
    if (input.galleries !== undefined) updateData.galleries = input.galleries || [];
    if (input.contact_email !== undefined) updateData.contact_email = input.contact_email?.trim() || null;
    if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Update the profile
    const { data, error } = await client
      .from('user_profiles')
      .update(updateData)
      .eq('id', input.profileId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { error: error.message || 'Failed to update profile' };
    }

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/artists/${user.id}`);

    return { success: true, profile: data };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

