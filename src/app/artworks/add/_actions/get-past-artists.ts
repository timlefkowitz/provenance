'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export type PastArtist = {
  artist_name: string;
  artist_account_id: string | null;
  count: number;
};

/**
 * Get list of artists that a gallery has previously uploaded artwork for
 */
export async function getPastArtists(galleryId: string): Promise<PastArtist[]> {
  const client = getSupabaseServerClient();
  
  // Get user role to verify they're a gallery
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', galleryId)
    .single();

  if (!account) {
    return [];
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  
  // Only galleries have past artists
  if (userRole !== USER_ROLES.GALLERY) {
    return [];
  }

  // Get distinct artist names from artworks created by this gallery
  // Group by artist_name and artist_account_id to get unique combinations
  const { data, error } = await (client as any)
    .from('artworks')
    .select('artist_name, artist_account_id')
    .eq('account_id', galleryId)
    .not('artist_name', 'is', null)
    .neq('artist_name', '');

  if (error) {
    console.error('Error fetching past artists:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by artist_name and count occurrences
  const artistMap = new Map<string, PastArtist>();
  
  data.forEach((artwork: { artist_name: string; artist_account_id: string | null }) => {
    const key = artwork.artist_name.toLowerCase().trim();
    if (!artistMap.has(key)) {
      artistMap.set(key, {
        artist_name: artwork.artist_name.trim(),
        artist_account_id: artwork.artist_account_id,
        count: 0,
      });
    }
    const artist = artistMap.get(key)!;
    artist.count += 1;
    // Prefer artworks with artist_account_id if available
    if (artwork.artist_account_id && !artist.artist_account_id) {
      artist.artist_account_id = artwork.artist_account_id;
    }
  });

  // Convert to array and sort by count (most used first), then alphabetically
  const artists = Array.from(artistMap.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.artist_name.localeCompare(b.artist_name);
  });

  return artists;
}

