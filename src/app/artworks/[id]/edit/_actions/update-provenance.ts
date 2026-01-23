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
    soldBy?: string;
    soldByIsPublic?: boolean;
    exhibitionId?: string | null;
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
    if (provenance.soldBy !== undefined) {
      updateData.sold_by = provenance.soldBy || null;
    }
    if (provenance.soldByIsPublic !== undefined) {
      updateData.sold_by_is_public = provenance.soldByIsPublic;
    }

    const { error } = await (client as any)
      .from('artworks')
      .update(updateData)
      .eq('id', artworkId);

    if (error) {
      console.error('Error updating provenance:', error);
      return { error: error.message || 'Failed to update provenance' };
    }

    // Handle exhibition linking/unlinking if exhibitionId is provided
    if (provenance.exhibitionId !== undefined) {
      try {
        // Get current exhibition link
        const { data: currentLink } = await (client as any)
          .from('exhibition_artworks')
          .select('exhibition_id')
          .eq('artwork_id', artworkId)
          .maybeSingle();

        const currentExhibitionId = currentLink?.exhibition_id || null;
        const newExhibitionId = provenance.exhibitionId || null;

        // Only update if the exhibition has changed
        if (currentExhibitionId !== newExhibitionId) {
          // Remove from current exhibition if linked
          if (currentExhibitionId) {
            await (client as any)
              .from('exhibition_artworks')
              .delete()
              .eq('artwork_id', artworkId)
              .eq('exhibition_id', currentExhibitionId);
          }

          // Add to new exhibition if provided
          if (newExhibitionId) {
            // Verify the user owns this exhibition
            const { data: exhibition } = await (client as any)
              .from('exhibitions')
              .select('gallery_id')
              .eq('id', newExhibitionId)
              .single();

            if (exhibition && exhibition.gallery_id === user.id) {
              // Add artwork to exhibition (ignore duplicate errors)
              await (client as any)
                .from('exhibition_artworks')
                .insert({
                  exhibition_id: newExhibitionId,
                  artwork_id: artworkId,
                })
                .catch((exhibitionError: any) => {
                  // Ignore duplicate key errors
                  if (exhibitionError.code !== '23505') {
                    console.error('Error adding artwork to exhibition:', exhibitionError);
                  }
                });
            } else {
              console.warn(`User ${user.id} does not own exhibition ${newExhibitionId}`);
            }
          }
        }
      } catch (exhibitionError) {
        // Don't fail the entire update if exhibition linking fails
        console.error('Error updating exhibition link:', exhibitionError);
      }
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
    
    // Revalidate exhibition pages if exhibition was changed
    if (provenance.exhibitionId !== undefined) {
      // Revalidate all exhibitions (the specific one will be updated via the junction table)
      revalidatePath('/exhibitions');
      // Also revalidate the gallery profile page
      if (artwork.account_id) {
        revalidatePath(`/artists/${artwork.account_id}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateProvenance:', error);
    return { error: 'An unexpected error occurred' };
  }
}

