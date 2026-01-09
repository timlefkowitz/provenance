'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export async function getQueuedArtworks() {
  try {
    const client = getSupabaseServerAdminClient();
    
    // Get featured artwork IDs
    const { data: allAccounts } = await client
      .from('accounts')
      .select('id, public_data')
      .limit(100);

    // Collect ALL featured artwork IDs from ALL accounts (consolidated)
    let featuredArtworkIds: string[] = [];
    for (const account of allAccounts || []) {
      const publicData = account.public_data as Record<string, any>;
      if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
        // Merge all IDs from all accounts (avoid duplicates)
        for (const id of publicData.featured_artworks) {
          if (!featuredArtworkIds.includes(id)) {
            featuredArtworkIds.push(id);
          }
        }
      }
    }

    // Get all verified, public artworks
    let query = client
      .from('artworks')
      .select('id, title, description, artist_name, image_url, created_at, status, is_public, certificate_number')
      .eq('status', 'verified')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    const { data: allArtworks, error } = await query;

    if (error) {
      console.error('Error fetching queued artworks:', error);
      return {
        artworks: [],
        error: 'Failed to load queued artworks',
      };
    }

    // Filter out featured artworks to get queued ones
    const queuedArtworks = (allArtworks || []).filter(
      (artwork) => !featuredArtworkIds.includes(artwork.id)
    );

    return {
      artworks: queuedArtworks,
      featuredCount: featuredArtworkIds.length,
      totalCount: allArtworks?.length || 0,
    };
  } catch (error) {
    console.error('Error getting queued artworks:', error);
    return {
      artworks: [],
      error: 'Failed to load queued artworks',
    };
  }
}

