'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type Exhibition = {
  id: string;
  gallery_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ExhibitionWithDetails = Exhibition & {
  artists: Array<{
    id: string;
    name: string;
    picture_url: string | null;
  }>;
  artworks: Array<{
    id: string;
    title: string;
    image_url: string | null;
  }>;
};

export async function getExhibitionsForGallery(galleryId: string): Promise<Exhibition[]> {
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('exhibitions')
    .select('*')
    .eq('gallery_id', galleryId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching exhibitions:', error);
    return [];
  }

  return data || [];
}

export async function getExhibitionWithDetails(exhibitionId: string): Promise<ExhibitionWithDetails | null> {
  const client = getSupabaseServerClient();

  // Get exhibition
  const { data: exhibition, error: exhibitionError } = await (client as any)
    .from('exhibitions')
    .select('*')
    .eq('id', exhibitionId)
    .single();

  if (exhibitionError || !exhibition) {
    return null;
  }

  // Get artists
  const { data: artists } = await (client as any)
    .from('exhibition_artists')
    .select(`
      artist_account_id,
      accounts!exhibition_artists_artist_account_id_fkey (
        id,
        name,
        picture_url
      )
    `)
    .eq('exhibition_id', exhibitionId);

  // Get artworks - fetch all artworks linked to this exhibition
  const { data: artworks, error: artworksError } = await (client as any)
    .from('exhibition_artworks')
    .select(`
      artwork_id,
      artworks!exhibition_artworks_artwork_id_fkey (
        id,
        title,
        image_url,
        status,
        is_public
      )
    `)
    .eq('exhibition_id', exhibitionId);

  if (artworksError) {
    console.error('Error fetching exhibition artworks:', artworksError);
  }

  return {
    ...exhibition,
    artists: (artists || []).map((ea: any) => ({
      id: ea.accounts.id,
      name: ea.accounts.name,
      picture_url: ea.accounts.picture_url,
    })),
    artworks: (artworks || [])
      .filter((ea: any) => ea.artworks && ea.artworks.status === 'verified') // Only show verified artworks
      .map((ea: any) => ({
        id: ea.artworks.id,
        title: ea.artworks.title,
        image_url: ea.artworks.image_url,
      })),
  };
}

