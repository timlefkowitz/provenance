'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Get all artworks that are linked to any of a gallery's exhibitions
 */
export async function getArtworksFromGalleryExhibitions(galleryId: string, limit: number = 12) {
  const client = getSupabaseServerClient();

  // First, get all exhibition IDs for this gallery
  const { data: exhibitions, error: exhibitionsError } = await (client as any)
    .from('exhibitions')
    .select('id')
    .eq('gallery_id', galleryId);

  if (exhibitionsError || !exhibitions || exhibitions.length === 0) {
    return [];
  }

  const exhibitionIds = exhibitions.map((e: any) => e.id);

  // Get all artworks linked to these exhibitions
  const { data: exhibitionArtworks, error: artworksError } = await (client as any)
    .from('exhibition_artworks')
    .select(`
      artwork_id,
      artworks!exhibition_artworks_artwork_id_fkey (
        id,
        title,
        artist_name,
        image_url,
        created_at,
        certificate_number,
        account_id,
        is_public,
        status
      )
    `)
    .in('exhibition_id', exhibitionIds);

  if (artworksError || !exhibitionArtworks) {
    console.error('Error fetching exhibition artworks:', artworksError);
    return [];
  }

  // Extract artworks, filter for verified status, and remove duplicates
  const artworksMap = new Map();
  (exhibitionArtworks || []).forEach((ea: any) => {
    const artwork = ea.artworks;
    if (artwork && artwork.status === 'verified' && !artworksMap.has(artwork.id)) {
      artworksMap.set(artwork.id, artwork);
    }
  });

  // Convert map to array and limit results
  const artworks = Array.from(artworksMap.values())
    .sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);

  return artworks;
}

