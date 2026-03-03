'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { logger } from '~/lib/logger';

/**
 * Get all gallery profiles for a user
 * Used when posting artworks to select which gallery profile to post as
 */
export async function getUserGalleryProfiles(userId: string): Promise<UserProfile[]> {
  try {
    const client = getSupabaseServerClient();

    const { data, error } = await (client as any)
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('get_user_gallery_profiles_error', {
        userId,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return [];
    }

    return ((data || []) as unknown) as UserProfile[];
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('get_user_gallery_profiles_exception', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    return [];
  }
}

