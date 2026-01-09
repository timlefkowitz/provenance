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

    // Filter to only public artworks first, then randomly select
    // Fetch all featured artworks to check which are public
    const { data: allFeaturedArtworks } = await (client as any)
      .from('artworks')
      .select('id, title, description, image_url, artist_name')
      .in('id', featuredArtworkIds)
      .eq('status', 'verified')
      .eq('is_public', true);

    if (!allFeaturedArtworks || allFeaturedArtworks.length === 0) {
      // No public featured artworks available
      return {
        featuredEntry: null,
      };
    }

    // Randomly select one from the public artworks
    const randomIndex = Math.floor(Math.random() * allFeaturedArtworks.length);
    const artwork = allFeaturedArtworks[randomIndex];

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
      .eq('status', 'verified')
      .eq('is_public', true);

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

