'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

/**
 * Fix artist names for specific artworks
 * Updates artist_name and optionally artist_account_id
 */
export async function fixArtistNames(
  artworkIds: string[],
  correctArtistName: string
) {
  try {
    const client = getSupabaseServerAdminClient();
    
    // First, try to find the correct artist account
    const { data: artistAccount } = await client
      .from('accounts')
      .select('id, name, public_data')
      .ilike('name', correctArtistName.trim())
      .limit(1)
      .single();

    let artistAccountId: string | null = null;
    
    if (artistAccount) {
      const artistRole = getUserRole(artistAccount.public_data as Record<string, any>);
      if (artistRole === USER_ROLES.ARTIST) {
        artistAccountId = artistAccount.id;
        console.log(`Found artist account for "${correctArtistName}": ${artistAccountId}`);
      }
    }

    // Update all specified artworks
    const updateData: any = {
      artist_name: correctArtistName.trim(),
    };

    if (artistAccountId) {
      updateData.artist_account_id = artistAccountId;
    }

    const { data: updatedArtworks, error } = await client
      .from('artworks')
      .update(updateData)
      .in('id', artworkIds)
      .select('id, title, artist_name');

    if (error) {
      console.error('Error updating artworks:', error);
      return {
        success: false,
        error: error.message || 'Failed to update artworks',
        updatedCount: 0,
      };
    }

    console.log(`Successfully updated ${updatedArtworks?.length || 0} artworks`);
    
    return {
      success: true,
      updatedCount: updatedArtworks?.length || 0,
      updatedArtworks: updatedArtworks || [],
      artistAccountId,
    };
  } catch (error) {
    console.error('Error in fixArtistNames:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      updatedCount: 0,
    };
  }
}

