'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Get all artworks that are linked to any of a gallery's exhibitions
 */
export async function getArtworksFromGalleryExhibitions(galleryId: string, limit: number = 12) {
  const client = getSupabaseServerClient();

  try {
    // First, get all exhibition IDs for this gallery
    const { data: exhibitions, error: exhibitionsError } = await (client as any)
      .from('exhibitions')
      .select('id')
      .eq('gallery_id', galleryId);

    if (exhibitionsError) {
      console.error('Error fetching exhibitions for gallery:', galleryId, exhibitionsError);
      return [];
    }

    if (!exhibitions || exhibitions.length === 0) {
      // No exhibitions found for this gallery - this is not an error, just return empty
      return [];
    }

    const exhibitionIds = exhibitions.map((e: any) => e.id);

    // Get all artwork IDs linked to these exhibitions
    const { data: exhibitionArtworks, error: artworksError } = await (client as any)
      .from('exhibition_artworks')
      .select('artwork_id')
      .in('exhibition_id', exhibitionIds);

    if (artworksError) {
      console.error('Error fetching exhibition artworks:', artworksError);
      return [];
    }

    if (!exhibitionArtworks || exhibitionArtworks.length === 0) {
      // No artworks linked to exhibitions - this is not an error, just return empty
      return [];
    }

    // Extract unique artwork IDs
    const artworkIds = [...new Set(exhibitionArtworks.map((ea: any) => ea.artwork_id))];

    if (artworkIds.length === 0) {
      return [];
    }

    // Fetch the actual artworks
    const { data: artworks, error: artworksFetchError } = await (client as any)
      .from('artworks')
      .select(
        'id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status'
      )
      .in('id', artworkIds)
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (artworksFetchError) {
      console.error('Error fetching artworks:', artworksFetchError);
      return [];
    }

    return artworks || [];
  } catch (error) {
    console.error('Unexpected error in getArtworksFromGalleryExhibitions:', error);
    return [];
  }
}

