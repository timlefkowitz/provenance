'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

/**
 * Delete an artwork (only the owner can delete)
 */
export async function deleteArtwork(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get artwork to verify ownership
  const { data: artwork, error: artworkError } = await (client as any)
    .from('artworks')
    .select('id, account_id, image_url, gallery_profile_id')
    .eq('id', artworkId)
    .single();

  if (artworkError || !artwork) {
    throw new Error('Artwork not found');
  }

  // Verify ownership or gallery membership
  const isOwner = artwork.account_id === user.id;
  let isGalleryMember = false;

  // Check if user is a member of the gallery that posted this artwork
  if (!isOwner && artwork.gallery_profile_id) {
    const { data: member } = await client
      .from('gallery_members')
      .select('id')
      .eq('gallery_profile_id', artwork.gallery_profile_id)
      .eq('user_id', user.id)
      .single();

    isGalleryMember = !!member;
  }

  if (!isOwner && !isGalleryMember) {
    throw new Error('You can only delete your own artworks');
  }

  // Delete the artwork (this will cascade delete related notifications due to foreign key)
  const { error: deleteError } = await (client as any)
    .from('artworks')
    .delete()
    .eq('id', artworkId)
    .eq('account_id', user.id); // Double check ownership in the delete query

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

