'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type ArtworkExhibition = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
} | null;

/**
 * Get the exhibition that an artwork is linked to
 */
export async function getArtworkExhibition(artworkId: string): Promise<ArtworkExhibition> {
  const client = getSupabaseServerClient();

  // Get exhibition from junction table
  const { data: exhibitionArtwork, error } = await (client as any)
    .from('exhibition_artworks')
    .select(`
      exhibition_id,
      exhibitions!exhibition_artworks_exhibition_id_fkey (
        id,
        title,
        start_date,
        end_date,
        location
      )
    `)
    .eq('artwork_id', artworkId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching artwork exhibition:', error);
    return null;
  }

  if (!exhibitionArtwork || !exhibitionArtwork.exhibitions) {
    return null;
  }

  return {
    id: exhibitionArtwork.exhibitions.id,
    title: exhibitionArtwork.exhibitions.title,
    start_date: exhibitionArtwork.exhibitions.start_date,
    end_date: exhibitionArtwork.exhibitions.end_date,
    location: exhibitionArtwork.exhibitions.location,
  };
}

