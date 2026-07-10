'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { artworkImageUploader } from '~/lib/artwork-storage';

export async function updateArtworkImage(
  artworkId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; imageUrl?: string }> {
  console.log('[Collection] updateArtworkImage started', { artworkId });

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to upload a photo' };
    }

    const { data: artwork, error: artworkError } = await asUntyped(client)
      .from('artworks')
      .select('id, account_id, gallery_profile_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[Collection] updateArtworkImage artwork not found', artworkError);
      return { success: false, error: 'Artwork not found' };
    }

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });

    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this artwork' };
    }

    const imageFile = formData.get('image');
    if (!(imageFile instanceof File) || imageFile.size === 0) {
      return { success: false, error: 'No image file provided' };
    }

    if (!imageFile.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }

    const adminClient = getSupabaseServerAdminClient();
    const imageUrl = await artworkImageUploader.upload(
      client,
      adminClient,
      imageFile,
      user.id,
    );

    if (!imageUrl) {
      return { success: false, error: 'Image upload failed' };
    }

    const { error: updateError } = await asUntyped(client)
      .from('artworks')
      .update({ image_url: imageUrl })
      .eq('id', artworkId);

    if (updateError) {
      console.error('[Collection] updateArtworkImage db update failed', updateError);
      return { success: false, error: 'Failed to save image' };
    }

    revalidatePath('/artworks/my');
    revalidatePath(`/artworks/${artworkId}/certificate`);

    console.log('[Collection] updateArtworkImage succeeded', { artworkId });
    return { success: true, imageUrl };
  } catch (err) {
    console.error('[Collection] updateArtworkImage failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload photo',
    };
  }
}
