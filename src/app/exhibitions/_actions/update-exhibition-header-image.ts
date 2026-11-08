'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { artworkImageUploader } from '~/lib/artwork-storage';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { HEADER_ARTWORK_METADATA_KEY } from '../_helpers/header-image';

export type UpdateExhibitionHeaderResult =
  | { success: true; imageUrl: string | null; artworkId: string | null }
  | { success: false; error: string };

/**
 * Sets the image that leads an exhibition's page. The form carries one of:
 * - `image`: a file to upload,
 * - `artworkId`: an artwork in this exhibition whose image to use,
 * - `remove=1`: clear the header.
 *
 * The image is saved to `exhibitions.image_url` (also used for link previews
 * and site cards). A chosen artwork is remembered in
 * `metadata.header_artwork_id` so the page follows that artwork's current image.
 */
export async function updateExhibitionHeaderImage(
  exhibitionId: string,
  formData: FormData,
): Promise<UpdateExhibitionHeaderResult> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Sign in to change the header image.' };

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

  let imageUrl: string | null = null;
  let artworkId: string | null = null;

  const artworkIdField = formData.get('artworkId');
  const file = formData.get('image');

  if (formData.get('remove') === '1') {
    // Cleared below.
  } else if (typeof artworkIdField === 'string' && artworkIdField) {
    const { data: link } = await admin
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', exhibitionId)
      .eq('artwork_id', artworkIdField)
      .maybeSingle();
    if (!link) return { success: false, error: 'That artwork is not in this exhibition.' };

    const { data: artwork } = await admin
      .from('artworks')
      .select('id, image_url')
      .eq('id', artworkIdField)
      .maybeSingle();
    const artworkImage = (artwork?.image_url as string | null)?.trim();
    if (!artworkImage) return { success: false, error: 'That artwork has no image yet.' };

    imageUrl = artworkImage;
    artworkId = artworkIdField;
  } else if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await artworkImageUploader.upload(client, admin, file, user.id);
    } catch (err) {
      console.error('[Exhibitions] header image upload failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not upload the image.',
      };
    }
  } else {
    return { success: false, error: 'Choose an image or an artwork.' };
  }

  const metadata: Record<string, unknown> = {
    ...((exhibition.metadata as Record<string, unknown> | null) ?? {}),
  };
  if (artworkId) metadata[HEADER_ARTWORK_METADATA_KEY] = artworkId;
  else delete metadata[HEADER_ARTWORK_METADATA_KEY];

  const { error: writeError } = await admin
    .from('exhibitions')
    .update({
      image_url: imageUrl,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exhibitionId);
  if (writeError) {
    console.error('[Exhibitions] updateExhibitionHeaderImage failed', writeError);
    return { success: false, error: 'Could not save the header image.' };
  }

  console.log('[Exhibitions] updateExhibitionHeaderImage', {
    exhibitionId,
    source: artworkId ? 'artwork' : imageUrl ? 'upload' : 'removed',
  });
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath('/exhibitions');
  return { success: true, imageUrl, artworkId };
}
