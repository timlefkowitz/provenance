'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

/**
 * Get all gallery profiles for a user
 * Used when posting artworks to select which gallery profile to post as
 */
export async function getUserGalleryProfiles(userId: string): Promise<UserProfile[]> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching gallery profiles:', error);
    return [];
  }

  return (data || []) as UserProfile[];
}

