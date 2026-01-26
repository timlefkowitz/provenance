'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { updateProvenance } from '../../[id]/edit/_actions/update-provenance';

export async function batchUpdateProvenance(
  artworkIds: string[],
  provenance: {
    artist_name?: string;
    description?: string;
    creationDate?: string;
    medium?: string;
    dimensions?: string;
    formerOwners?: string;
    auctionHistory?: string;
    exhibitionHistory?: string;
    historicContext?: string;
    celebrityNotes?: string;
    isPublic?: boolean;
    value?: string;
    valueIsPublic?: boolean;
    edition?: string;
    productionLocation?: string;
    ownedBy?: string;
    ownedByIsPublic?: boolean;
    soldBy?: string;
    soldByIsPublic?: boolean;
  }
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update provenance' };
    }

    if (artworkIds.length === 0) {
      return { error: 'No artworks selected' };
    }

    // Verify user owns all artworks
    const { data: artworks, error: fetchError } = await client
      .from('artworks')
      .select('id, account_id')
      .in('id', artworkIds);

    if (fetchError || !artworks) {
      return { error: 'Error fetching artworks' };
    }

    // Check ownership
    const unauthorizedArtworks = artworks.filter(a => a.account_id !== user.id);
    if (unauthorizedArtworks.length > 0) {
      return { error: 'You do not have permission to edit some of these artworks' };
    }

    // Update each artwork
    let successCount = 0;
    const errors: string[] = [];

    for (const artworkId of artworkIds) {
      try {
        const result = await updateProvenance(artworkId, provenance, {
          skipOwnershipCheck: true, // We already verified ownership above
          skipNotification: true, // Don't send notifications for batch updates
        });

        if (result.error) {
          errors.push(`Artwork ${artworkId}: ${result.error}`);
        } else {
          successCount++;
        }
      } catch (error) {
        errors.push(`Artwork ${artworkId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Revalidate relevant paths
    revalidatePath('/artworks/my');
    revalidatePath('/artworks');
    revalidatePath('/profile');

    if (errors.length > 0 && successCount === 0) {
      return { error: `Failed to update artworks: ${errors.join(', ')}` };
    }

    if (errors.length > 0) {
      return { 
        success: true, 
        updatedCount: successCount,
        error: `Updated ${successCount} artworks, but some failed: ${errors.join(', ')}` 
      };
    }

    return { success: true, updatedCount: successCount };
  } catch (error) {
    console.error('Error in batchUpdateProvenance:', error);
    return { error: 'An unexpected error occurred' };
  }
}
