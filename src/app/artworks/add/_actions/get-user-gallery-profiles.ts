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

    // Profiles this user owns
    const { data: ownedProfiles, error: ownedError } = await (client as any)
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (ownedError) {
      logger.error('get_user_gallery_profiles_owned_error', {
        userId,
        message: ownedError.message,
        code: ownedError.code,
        details: ownedError.details,
      });
    }

    // Profiles this user is a member of (gallery team)
    const { data: memberRows, error: memberError } = await (client as any)
      .from('gallery_members')
      .select('gallery_profile_id')
      .eq('user_id', userId);

    if (memberError) {
      logger.error('get_user_gallery_profiles_members_error', {
        userId,
        message: memberError.message,
        code: memberError.code,
        details: memberError.details,
      });
    }

    const memberProfileIds = Array.from(
      new Set(
        (memberRows || [])
          .map((row: any) => row.gallery_profile_id)
          .filter((id: unknown): id is string => typeof id === 'string'),
      ),
    );

    let memberProfiles: UserProfile[] = [];

    if (memberProfileIds.length > 0) {
      const { data: profilesForMembership, error: profilesError } = await (client as any)
        .from('user_profiles')
        .select('*')
        .in('id', memberProfileIds)
        .eq('role', USER_ROLES.GALLERY)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (profilesError) {
        logger.error('get_user_gallery_profiles_members_profiles_error', {
          userId,
          message: profilesError.message,
          code: profilesError.code,
          details: profilesError.details,
        });
      } else if (profilesForMembership) {
        memberProfiles = profilesForMembership as unknown as UserProfile[];
      }
    }

    const owned = (ownedProfiles || []) as unknown as UserProfile[];

    // Merge owned and member profiles, de-duplicated by id
    const allProfilesMap = new Map<string, UserProfile>();

    for (const profile of owned) {
      allProfilesMap.set(profile.id, profile);
    }
    for (const profile of memberProfiles) {
      allProfilesMap.set(profile.id, profile);
    }

    return Array.from(allProfilesMap.values());
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

