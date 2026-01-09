'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { isAdmin } from '~/lib/admin';
import { revalidatePath } from 'next/cache';

/**
 * Get all featured artwork IDs across all accounts (consolidated)
 */
async function getAllFeaturedArtworkIds(): Promise<string[]> {
  const adminClient = getSupabaseServerAdminClient();
  
  const { data: allAccounts } = await adminClient
    .from('accounts')
    .select('id, public_data')
    .limit(100);

  // Collect ALL featured artwork IDs from ALL accounts
  const allFeaturedIds: string[] = [];
  for (const account of allAccounts || []) {
    const publicData = account.public_data as Record<string, any>;
    if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
      // Add all IDs from this account (avoid duplicates)
      for (const id of publicData.featured_artworks) {
        if (!allFeaturedIds.includes(id)) {
          allFeaturedIds.push(id);
        }
      }
    }
  }

  return allFeaturedIds;
}

/**
 * Get the account ID that has the featured_artworks array, or return null if none exists
 */
async function getFeaturedArtworksAccountId(): Promise<string | null> {
  const adminClient = getSupabaseServerAdminClient();
  
  const { data: allAccounts } = await adminClient
    .from('accounts')
    .select('id, public_data')
    .limit(100);

  // Find the first account with featured_artworks array
  for (const account of allAccounts || []) {
    const publicData = account.public_data as Record<string, any>;
    if (publicData?.featured_artworks && Array.isArray(publicData.featured_artworks)) {
      return account.id;
    }
  }

  return null;
}

/**
 * Check if an artwork is already featured
 */
export async function isArtworkFeatured(artworkId: string): Promise<boolean> {
  try {
    const featuredIds = await getAllFeaturedArtworkIds();
    return featuredIds.includes(artworkId);
  } catch (error) {
    console.error('Error checking if artwork is featured:', error);
    return false;
  }
}

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

    // Check across all accounts if artwork is already featured
    const allFeaturedIds = await getAllFeaturedArtworkIds();
    if (allFeaturedIds.includes(artworkId)) {
      return { error: 'This artwork is already featured' };
    }

    // Check if we've reached the limit of 10
    if (allFeaturedIds.length >= 10) {
      return { error: 'Maximum of 10 featured artworks allowed. Please remove one first.' };
    }

    // Find the account that has the featured_artworks array, or use current user's account
    const featuredAccountId = await getFeaturedArtworksAccountId();
    const targetAccountId = featuredAccountId || user.id;

    // Get target account data
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', targetAccountId)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};
    
    // Consolidate: use all featured IDs from all accounts, then add the new one
    // This ensures we don't lose any artworks that might be in other accounts
    const consolidatedFeaturedArtworks = [...allFeaturedIds, artworkId];
    
    // Remove duplicates (shouldn't happen, but just in case)
    const uniqueFeaturedArtworks = Array.from(new Set(consolidatedFeaturedArtworks));

    // Update public_data on the target account with consolidated list
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: uniqueFeaturedArtworks,
        },
      })
      .eq('id', targetAccountId);

    // Clean up: Remove featured_artworks from other accounts to avoid duplication
    if (featuredAccountId) {
      const adminClient = getSupabaseServerAdminClient();
      const { data: otherAccounts } = await adminClient
        .from('accounts')
        .select('id, public_data')
        .neq('id', targetAccountId)
        .limit(100);

      for (const otherAccount of otherAccounts || []) {
        const otherPublicData = (otherAccount.public_data as Record<string, any>) || {};
        if (otherPublicData?.featured_artworks && Array.isArray(otherPublicData.featured_artworks)) {
          // Remove featured_artworks from this account
          const { featured_artworks, ...restPublicData } = otherPublicData;
          await adminClient
            .from('accounts')
            .update({
              public_data: restPublicData,
            })
            .eq('id', otherAccount.id);
        }
      }
    }

    if (error) {
      console.error('Error adding featured artwork:', error);
      return { error: error.message || 'Failed to add featured artwork' };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/queued-artworks');
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

    // Find the account that has the featured_artworks array
    const featuredAccountId = await getFeaturedArtworksAccountId();
    if (!featuredAccountId) {
      return { error: 'No featured artworks found' };
    }

    // Get account data
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', featuredAccountId)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};
    const featuredArtworks = (currentPublicData.featured_artworks as string[]) || [];

    // Remove from list
    const updatedFeaturedArtworks = featuredArtworks.filter((id: string) => id !== artworkId);

    // Update public_data on the account that has featured artworks
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_artworks: updatedFeaturedArtworks,
        },
      })
      .eq('id', featuredAccountId);

    if (error) {
      console.error('Error removing featured artwork:', error);
      return { error: error.message || 'Failed to remove featured artwork' };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/queued-artworks');

    return { success: true };
  } catch (error) {
    console.error('Error in removeFeaturedArtwork:', error);
    return { error: 'An unexpected error occurred' };
  }
}

