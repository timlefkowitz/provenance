'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';

export async function updateProvenance(
  artworkId: string,
  provenance: {
    title?: string;
    description?: string;
    artist_name?: string;
    medium?: string;
    creationDate?: string;
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
  },
  options?: {
    skipOwnershipCheck?: boolean;
    skipNotification?: boolean;
  }
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update provenance' };
    }

    // Verify the user owns this artwork
    const { data: artwork, error: fetchError } = await (client as any)
      .from('artworks')
      .select('account_id, title')
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      return { error: 'Artwork not found' };
    }

    if (!options?.skipOwnershipCheck && artwork.account_id !== user.id) {
      return { error: 'You do not have permission to edit this artwork' };
    }

    // Store original title to check if it changed
    const originalTitle = artwork.title;

    // Update title, provenance fields and privacy
    const updateData: any = {
      updated_by: user.id,
    };

    // Only update fields that are provided
    if (provenance.title !== undefined) {
      updateData.title = provenance.title?.trim() || null;
    }
    if (provenance.description !== undefined) {
      updateData.description = provenance.description || null;
    }
    if (provenance.artist_name !== undefined) {
      updateData.artist_name = provenance.artist_name || null;
    }
    if (provenance.medium !== undefined) {
      updateData.medium = provenance.medium || null;
    }
    if (provenance.creationDate !== undefined) {
      updateData.creation_date = provenance.creationDate || null;
    }
    if (provenance.dimensions !== undefined) {
      updateData.dimensions = provenance.dimensions || null;
    }
    if (provenance.formerOwners !== undefined) {
      updateData.former_owners = provenance.formerOwners || null;
    }
    if (provenance.auctionHistory !== undefined) {
      updateData.auction_history = provenance.auctionHistory || null;
    }
    if (provenance.exhibitionHistory !== undefined) {
      updateData.exhibition_history = provenance.exhibitionHistory || null;
    }
    if (provenance.historicContext !== undefined) {
      updateData.historic_context = provenance.historicContext || null;
    }
    if (provenance.celebrityNotes !== undefined) {
      updateData.celebrity_notes = provenance.celebrityNotes || null;
    }

    // Only update is_public if it's provided
    if (provenance.isPublic !== undefined) {
      updateData.is_public = provenance.isPublic;
    }

    // Add new fields
    if (provenance.value !== undefined) {
      updateData.value = provenance.value || null;
    }
    if (provenance.valueIsPublic !== undefined) {
      updateData.value_is_public = provenance.valueIsPublic;
    }
    if (provenance.edition !== undefined) {
      updateData.edition = provenance.edition || null;
    }
    if (provenance.productionLocation !== undefined) {
      updateData.production_location = provenance.productionLocation || null;
    }
    if (provenance.ownedBy !== undefined) {
      updateData.owned_by = provenance.ownedBy || null;
    }
    if (provenance.ownedByIsPublic !== undefined) {
      updateData.owned_by_is_public = provenance.ownedByIsPublic;
    }

    const { error } = await (client as any)
      .from('artworks')
      .update(updateData)
      .eq('id', artworkId);

    if (error) {
      console.error('Error updating provenance:', error);
      return { error: error.message || 'Failed to update provenance' };
    }

    // Create notification for artwork owner about the update (unless skipped)
    if (!options?.skipNotification) {
      try {
        await createNotification({
          userId: artwork.account_id,
          type: 'artwork_updated',
          title: 'Artwork Updated',
          message: `Your artwork "${provenance.title || originalTitle}" has been updated`,
          artworkId: artworkId,
          metadata: {
            updated_fields: Object.keys(provenance).filter(key => provenance[key as keyof typeof provenance] !== undefined),
          },
        });
      } catch (error) {
        // Don't fail the update if notification fails
        console.error('Error creating update notification:', error);
      }
    }

    revalidatePath(`/artworks/${artworkId}`);
    revalidatePath(`/artworks/${artworkId}/certificate`);
    revalidatePath('/artworks'); // Revalidate the artworks feed
    revalidatePath('/portal');
    revalidatePath('/notifications');

    return { success: true };
  } catch (error) {
    console.error('Error in updateProvenance:', error);
    return { error: 'An unexpected error occurred' };
  }
}

