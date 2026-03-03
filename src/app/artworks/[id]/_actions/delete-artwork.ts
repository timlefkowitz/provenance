'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';

/**
 * Delete an artwork (owner or gallery team member can delete)
 */
export async function deleteArtwork(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get artwork to verify ownership or gallery membership
  const { data: artwork, error: artworkError } = await (client as any)
    .from('artworks')
    .select('id, account_id, image_url, gallery_profile_id')
    .eq('id', artworkId)
    .single();

  if (artworkError || !artwork) {
    throw new Error('Artwork not found');
  }

  const canDelete = await canEditGalleryArtworks(user.id, {
    account_id: artwork.account_id,
    gallery_profile_id: artwork.gallery_profile_id ?? undefined,
  });

  if (!canDelete) {
    throw new Error('You can only delete your own artworks');
  }

  // Delete by id; RLS allows owner or gallery member
  const { error: deleteError } = await (client as any)
    .from('artworks')
    .delete()
    .eq('id', artworkId);

  if (deleteError) {
    throw new Error(`Failed to delete artwork: ${deleteError.message}`);
  }

  // Note: We don't delete the image from storage here to avoid breaking existing references
  // If you want to delete the image, you would need to:
  // 1. Extract the file path from image_url
  // 2. Use storage client to delete the file
  // For now, we'll leave images in storage (they can be cleaned up later if needed)

  revalidatePath('/artworks');
  revalidatePath('/notifications');

  return { success: true };
}

