'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type ToggleArtworkVisibilityResult =
  | { success: true; isPublic: boolean }
  | { success: false; error: string };

/**
 * Flip the public listing flag on an artwork the caller owns.
 *
 * Authorization: enforced by `account_id = user.id` on the update. The artwork
 * visibility RLS (status = verified AND is_public = true) is unchanged — this
 * action just flips the column so the RLS picks the work up (or removes it)
 * for everyone else.
 */
export async function toggleArtworkVisibility(
  artworkId: string,
  nextIsPublic: boolean,
): Promise<ToggleArtworkVisibilityResult> {
  console.log('[Artworks] toggleVisibility started', { artworkId, nextIsPublic });
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to change visibility.' };
  }

  const { data, error } = await client
    .from('artworks')
    .update({ is_public: nextIsPublic })
    .eq('id', artworkId)
    .eq('account_id', user.id)
    .select('id, is_public')
    .maybeSingle();

  if (error) {
    console.error('[Artworks] toggleVisibility update failed', error);
    return { success: false, error: 'Could not update visibility.' };
  }

  if (!data) {
    console.error('[Artworks] toggleVisibility — no artwork updated', {
      artworkId,
      userId: user.id,
    });
    return {
      success: false,
      error: 'Artwork not found or you do not have permission to update it.',
    };
  }

  revalidatePath('/artworks');
  revalidatePath('/artworks/my');

  console.log('[Artworks] toggleVisibility succeeded', {
    artworkId,
    isPublic: data.is_public,
  });

  return { success: true, isPublic: Boolean(data.is_public) };
}
