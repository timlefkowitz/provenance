'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { readPosterOverrides, type PosterOverrides } from '../_helpers/poster-text';

/**
 * Saves edits to the exhibition QR poster's text in
 * `exhibitions.metadata.posterText`, for everyone who manages the show.
 * Lines not in `overrides` keep their defaults; an empty string hides a line.
 */
export async function updateExhibitionPosterText(
  exhibitionId: string,
  overrides: PosterOverrides,
): Promise<{ success: true } | { success: false; error: string }> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Sign in to change the poster.' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition, error: readError } = await admin
    .from('exhibitions')
    .select('gallery_id, metadata')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (readError || !exhibition) return { success: false, error: 'Exhibition not found.' };
  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { success: false, error: 'You can only change exhibitions you manage.' };
  }

  const posterText = readPosterOverrides(overrides);
  const metadata = {
    ...((exhibition.metadata as Record<string, unknown> | null) ?? {}),
    posterText,
  };
  const { error: writeError } = await admin
    .from('exhibitions')
    .update({ metadata })
    .eq('id', exhibitionId);
  if (writeError) {
    console.error('[Exhibitions] updateExhibitionPosterText failed', writeError);
    return { success: false, error: 'Could not save the poster text.' };
  }

  console.log('[Exhibitions] updateExhibitionPosterText', {
    exhibitionId,
    fields: Object.keys(posterText),
  });
  revalidatePath(`/exhibitions/${exhibitionId}`);
  return { success: true };
}
