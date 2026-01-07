'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { revalidatePath } from 'next/cache';

export async function featureArtwork(artworkId: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to feature artworks' };
    }

    // Fetch artwork details
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, title, description, image_url, artist_name')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { error: 'Artwork not found' };
    }

    // Get current account data
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};

    // Update public_data with featured entry using artwork details
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_entry: {
            artwork_id: artwork.id,
            title: artwork.title,
            description: artwork.description || `A verified artwork by ${artwork.artist_name || 'an artist'}`,
            link_url: `/artworks/${artwork.id}/certificate`,
            image_url: artwork.image_url,
          },
        },
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error featuring artwork:', error);
      return { error: error.message || 'Failed to feature artwork' };
    }

    revalidatePath('/');
    revalidatePath(`/artworks/${artworkId}/certificate`);

    return { success: true };
  } catch (error) {
    console.error('Error in featureArtwork:', error);
    return { error: 'An unexpected error occurred' };
  }
}

