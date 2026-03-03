'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';

/**
 * Add an artwork to user's favorites
 */
export async function addFavorite(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to favorite artworks');
  }

  // Get artwork info to find the owner
  const { data: artwork } = await (client as any)
    .from('artworks')
    .select('id, title, account_id')
    .eq('id', artworkId)
    .single();

  if (!artwork) {
    throw new Error('Artwork not found');
  }

  // Don't notify if user is favoriting their own artwork
  const shouldNotify = artwork.account_id !== user.id;

  const { error } = await client
    .from('artwork_favorites')
    .insert({
      user_id: user.id,
      artwork_id: artworkId,
    });

  if (error) {
    // If it's a unique constraint violation, the artwork is already favorited
    if (error.code === '23505') {
      return { success: true, alreadyFavorited: true };
    }
    logger.error('favorite_add_failed', {
      artworkId,
      userId: user.id,
      error,
    });
    throw new Error(`Failed to add favorite: ${error.message}`);
  }

  // Notify the artwork owner (if not favoriting own artwork)
  if (shouldNotify) {
    try {
      // Get the favoriter's name for the notification
      const { data: favoriterAccount } = await client
        .from('accounts')
        .select('name')
        .eq('id', user.id)
        .single();

      const favoriterName = favoriterAccount?.name || 'Someone';

      await createNotification({
        userId: artwork.account_id,
        type: 'artwork_favorited',
        title: 'Your Artwork Was Favorited',
        message: `${favoriterName} favorited your artwork "${artwork.title}"`,
        artworkId: artworkId,
        relatedUserId: user.id,
      });
    } catch (notifError) {
      // Don't fail favorite if notification fails
      logger.error('favorite_notification_failed', {
        artworkId,
        userId: user.id,
        ownerId: artwork.account_id,
        error: notifError,
      });
    }
  }

  revalidatePath('/portal');
  revalidatePath('/artworks');
  return { success: true, alreadyFavorited: false };
}

/**
 * Remove an artwork from user's favorites
 */
export async function removeFavorite(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to unfavorite artworks');
  }

  const { error } = await client
    .from('artwork_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('artwork_id', artworkId);

  if (error) {
    logger.error('favorite_remove_failed', {
      artworkId,
      userId: user.id,
      error,
    });
    throw new Error(`Failed to remove favorite: ${error.message}`);
  }

  revalidatePath('/portal');
  revalidatePath('/artworks');
  return { success: true };
}

/**
 * Check if an artwork is favorited by the current user
 */
export async function isFavorited(artworkId: string): Promise<boolean> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await client
    .from('artwork_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('artwork_id', artworkId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    logger.error('favorite_check_failed', {
      artworkId,
      userId: user.id,
      error,
    });
    return false;
  }

  return !!data;
}

/**
 * Get user's favorite artworks
 */
export async function getFavoriteArtworks(limit: number = 10) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return [];
  }

  // First get the favorite IDs
  const { data: favorites, error: favoritesError } = await client
    .from('artwork_favorites')
    .select('artwork_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (favoritesError) {
    logger.error('favorite_list_fetch_failed', {
      userId: user.id,
      error: favoritesError,
    });
    return [];
  }

  if (!favorites || favorites.length === 0) {
    return [];
  }

  // Then fetch the artworks
  const artworkIds = favorites.map((f: any) => f.artwork_id);
  const { data: artworks, error: artworksError } = await (client as any)
    .from('artworks')
    .select('id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status')
    .in('id', artworkIds);

  if (artworksError) {
    logger.error('favorite_artworks_fetch_failed', {
      userId: user.id,
      error: artworksError,
    });
    return [];
  }

  // Create a map of artwork_id to created_at for sorting
  const favoriteMap = new Map(
    favorites.map((f: any) => [f.artwork_id, f.created_at])
  );

  // Sort artworks by favorite date and return
  return (artworks || [])
    .map((artwork: any) => ({
      ...artwork,
      favorited_at: favoriteMap.get(artwork.id),
    }))
    .sort((a: any, b: any) => {
      const dateA = new Date(a.favorited_at).getTime();
      const dateB = new Date(b.favorited_at).getTime();
      return dateB - dateA; // Most recent first
    });
}

/**
 * Get count of user's favorite artworks
 */
export async function getFavoriteCount(): Promise<number> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return 0;
  }

  const { count, error } = await client
    .from('artwork_favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (error) {
    logger.error('favorite_count_failed', {
      userId: user.id,
      error,
    });
    return 0;
  }

  return count || 0;
}

