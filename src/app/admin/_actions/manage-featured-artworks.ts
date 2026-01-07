'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { revalidatePath } from 'next/cache';

export async function addFeaturedArtwork(artworkId: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to manage featured artworks' };
    }

    // Verify artwork exists and is verified
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, status')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { error: 'Artwork not found' };
    }

    if (artwork.status !== 'verified') {
      return { error: 'Only verified artworks can be featured' };
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
    const featuredArtworks = (currentPublicData.featured_artworks as string[]) || [];

    // Check if already in list
    if (featuredArtworks.includes(artworkId)) {
      return { error: 'This artwork is already featured' };
    }

    // Check if we've reached the limit of 10
    if (featuredArtworks.length >= 10) {
      return { error: 'Maximum of 10 featured artworks allowed. Please remove one first.' };
    }

    // Add to list
    const updatedFeaturedArtworks = [...featuredArtworks, artworkId];

    // Update public_data
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: updatedFeaturedArtworks,
        },
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error adding featured artwork:', error);
      return { error: error.message || 'Failed to add featured artwork' };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath(`/artworks/${artworkId}/certificate`);

    return { success: true };
  } catch (error) {
    console.error('Error in addFeaturedArtwork:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function removeFeaturedArtwork(artworkId: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to manage featured artworks' };
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
    const featuredArtworks = (currentPublicData.featured_artworks as string[]) || [];

    // Remove from list
    const updatedFeaturedArtworks = featuredArtworks.filter((id: string) => id !== artworkId);

    // Update public_data
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: updatedFeaturedArtworks,
        },
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error removing featured artwork:', error);
      return { error: error.message || 'Failed to remove featured artwork' };
    }

    revalidatePath('/');
    revalidatePath('/admin');

    return { success: true };
  } catch (error) {
    console.error('Error in removeFeaturedArtwork:', error);
    return { error: 'An unexpected error occurred' };
  }
}

