import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { logger } from '~/lib/logger';
import { carryOverArtistProfileContent } from './carry-over';

/**
 * Merge an unclaimed artist profile into the artist's existing profile, after
 * the claim has been approved. Certificates that credit the unclaimed profile
 * point at the artist instead, contributed content is carried over (never
 * overwriting the artist's own), and the duplicate is retired.
 *
 * Callers must already have authorised the merge.
 */
export async function mergeUnclaimedArtistProfile(params: {
  fromProfileId: string;
  toProfileId: string;
  artistUserId: string;
}): Promise<{ success: true; works: number } | { success: false; error: string }> {
  const db = asUntyped(getSupabaseServerAdminClient());
  const { fromProfileId, toProfileId, artistUserId } = params;
  const now = new Date().toISOString();

  // Credit the artist's account on works that had no account yet, then repoint the profile link.
  await db
    .from('artworks')
    .update({ artist_account_id: artistUserId })
    .eq('artist_profile_id', fromProfileId)
    .is('artist_account_id', null);
  const { data: moved, error: moveError } = await db
    .from('artworks')
    .update({ artist_profile_id: toProfileId })
    .eq('artist_profile_id', fromProfileId)
    .select('id');
  if (moveError) {
    logger.error('artist_profile_merge_move_works_failed', { fromProfileId, toProfileId, error: moveError });
    return { success: false, error: 'Could not move the works to your profile. Please try again.' };
  }

  await carryOverArtistProfileContent(db, fromProfileId, toProfileId);

  const { error: retireError } = await db
    .from('user_profiles')
    .update({ is_active: false, updated_at: now })
    .eq('id', fromProfileId)
    .is('user_id', null);
  if (retireError) {
    logger.error('artist_profile_merge_retire_failed', { fromProfileId, error: retireError });
  }

  return { success: true, works: moved?.length ?? 0 };
}
