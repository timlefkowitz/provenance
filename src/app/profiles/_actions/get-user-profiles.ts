'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';

export type UserProfile = {
  id: string;
  user_id: string;
  role: UserRole;
  name: string;
  picture_url: string | null;
  bio: string | null;
  medium: string | null;
  location: string | null;
  website: string | null;
  links: string[] | null;
  galleries: string[] | null;
  contact_email: string | null;
  phone: string | null;
  established_year: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Get all profiles for the current user
 */
export async function getUserProfiles(userId: string): Promise<UserProfile[]> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching user profiles:', error);
    return [];
  }

  return (data || []) as UserProfile[];
}

/**
 * Get a specific profile by user ID and role
 * For galleries, returns the first active profile (since multiple are allowed)
 * For artist/collector, returns the single profile
 */
export async function getUserProfileByRole(
  userId: string,
  role: UserRole
): Promise<UserProfile | null> {
  const client = getSupabaseServerClient();

  // For galleries, we can have multiple, so get the first one
  // For artist/collector, there should only be one
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('role', role)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return (data || null) as UserProfile | null;
}

/**
 * Get a specific profile by profile ID
 */
export async function getUserProfileById(
  profileId: string
): Promise<UserProfile | null> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found
      return null;
    }
    console.error('Error fetching profile by ID:', error);
    return null;
  }

  return data as UserProfile;
}

