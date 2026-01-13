'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { isValidRole, type UserRole } from '~/lib/user-roles';

export interface CreateProfileInput {
  role: string;
  name: string;
  picture_url?: string;
  bio?: string;
  medium?: string;
  location?: string;
  website?: string;
  links?: string[];
  galleries?: string[];
  contact_email?: string;
  phone?: string;
  established_year?: number;
}

/**
 * Create a new role profile for the current user
 */
export async function createProfile(input: CreateProfileInput) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to create a profile' };
    }

    if (!isValidRole(input.role)) {
      return { error: 'Invalid role' };
    }

    // Check if profile already exists for this role
    const { data: existing } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', input.role)
      .single();

    if (existing) {
      return { error: `You already have a ${input.role} profile. Please edit it instead.` };
    }

    // Create the profile
    const { data, error } = await client
      .from('user_profiles')
      .insert({
        user_id: user.id,
        role: input.role as UserRole,
        name: input.name.trim(),
        picture_url: input.picture_url || null,
        bio: input.bio?.trim() || null,
        medium: input.medium?.trim() || null,
        location: input.location?.trim() || null,
        website: input.website?.trim() || null,
        links: input.links || [],
        galleries: input.galleries || [],
        contact_email: input.contact_email?.trim() || null,
        phone: input.phone?.trim() || null,
        established_year: input.established_year || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return { error: error.message || 'Failed to create profile' };
    }

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/artists/${user.id}`);

    return { success: true, profile: data };
  } catch (error) {
    console.error('Error in createProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

