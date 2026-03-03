'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { updateProvenance } from '../../[id]/edit/_actions/update-provenance';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { logger } from '~/lib/logger';

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

    // Verify user owns or can edit all artworks (owner or gallery team member)
    const { data: artworks, error: fetchError } = await client
      .from('artworks')
      .select('id, account_id, gallery_profile_id')
      .in('id', artworkIds);

    if (fetchError || !artworks) {
      return { error: 'Error fetching artworks' };
    }

    for (const a of artworks) {
      const canEdit = await canEditGalleryArtworks(user.id, {
        account_id: a.account_id,
        gallery_profile_id: a.gallery_profile_id ?? undefined,
      });
      if (!canEdit) {
        return { error: 'You do not have permission to edit some of these artworks' };
      }
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
    logger.error('batch_update_provenance_failed', {
      artworkIds,
      error,
    });
    return { error: 'An unexpected error occurred' };
  }
}
