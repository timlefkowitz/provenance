'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function getFeaturedEntry() {
  try {
    const client = getSupabaseServerClient();
    
    // Check all accounts for featured_artworks array in public_data
    const { data: allAccounts } = await client
      .from('accounts')
      .select('id, public_data')
      .limit(100);

    // Find featured_artworks array in any account's public_data
    let featuredArtworkIds: string[] = [];
    for (const account of allAccounts || []) {
      const publicData = account.public_data as Record<string, any>;
      if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
        featuredArtworkIds = publicData.featured_artworks;
        break; // Use the first one we find
      }
    }

    // If no featured artworks, return null
    if (featuredArtworkIds.length === 0) {
      return {
        featuredEntry: null,
      };
    }

    // Randomly select one artwork from the list
    const randomIndex = Math.floor(Math.random() * featuredArtworkIds.length);
    const selectedArtworkId = featuredArtworkIds[randomIndex];

    // Fetch the selected artwork
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, title, description, image_url, artist_name')
      .eq('id', selectedArtworkId)
      .eq('status', 'verified')
      .single();

    if (artworkError || !artwork) {
      // If artwork not found or not verified, return null
      return {
        featuredEntry: null,
      };
    }

    // Return the artwork as featured entry
    return {
      featuredEntry: {
        artwork_id: artwork.id,
        title: artwork.title,
        description: artwork.description || `A verified artwork by ${artwork.artist_name || 'an artist'}`,
        link_url: `/artworks/${artwork.id}/certificate`,
        image_url: artwork.image_url,
      },
    };
  } catch (error) {
    console.error('Error getting featured entry:', error);
    return {
      featuredEntry: null,
      error: 'Failed to load featured entry',
    };
  }
}

export async function getFeaturedArtworksList() {
  try {
    const client = getSupabaseServerClient();
    
    // Check all accounts for featured_artworks array in public_data
    const { data: allAccounts } = await client
      .from('accounts')
      .select('id, public_data')
      .limit(100);

    // Find featured_artworks array in any account's public_data
    let featuredArtworkIds: string[] = [];
    for (const account of allAccounts || []) {
      const publicData = account.public_data as Record<string, any>;
      if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
        featuredArtworkIds = publicData.featured_artworks;
        break; // Use the first one we find
      }
    }

    // Fetch all featured artworks
    if (featuredArtworkIds.length === 0) {
      return {
        artworks: [],
      };
    }

    const { data: artworks, error } = await (client as any)
      .from('artworks')
      .select('id, title, artist_name, image_url')
      .in('id', featuredArtworkIds)
      .eq('status', 'verified');

    if (error) {
      console.error('Error fetching featured artworks:', error);
      return {
        artworks: [],
      };
    }

    // Sort by the order in featuredArtworkIds
    const sortedArtworks = (artworks || []).sort((a: any, b: any) => {
      const indexA = featuredArtworkIds.indexOf(a.id);
      const indexB = featuredArtworkIds.indexOf(b.id);
      return indexA - indexB;
    });

    return {
      artworks: sortedArtworks,
    };
  } catch (error) {
    console.error('Error getting featured artworks list:', error);
    return {
      artworks: [],
      error: 'Failed to load featured artworks',
    };
  }
}

