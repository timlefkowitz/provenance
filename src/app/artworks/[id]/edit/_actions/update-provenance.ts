'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import {
  canEditGalleryArtworks,
  canManageExhibition,
} from '~/app/profiles/_actions/gallery-members';
import { logger } from '~/lib/logger';

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
    isSold?: boolean;
    displayOrder?: number | null;
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

    // Fetch current artwork state — includes all provenance fields + existing history
    const { data: artwork, error: fetchError } = await (client as any)
      .from('artworks')
      .select(`
        account_id,
        title,
        gallery_profile_id,
        description,
        artist_name,
        medium,
        creation_date,
        dimensions,
        former_owners,
        auction_history,
        exhibition_history,
        historic_context,
        celebrity_notes,
        is_public,
        value,
        value_is_public,
        edition,
        production_location,
        owned_by,
        owned_by_is_public,
        sold_by,
        sold_by_is_public,
        is_sold,
        display_order,
        provenance_history
      `)
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      return { error: 'Artwork not found' };
    }

    if (!options?.skipOwnershipCheck) {
      const canEdit = await canEditGalleryArtworks(user.id, {
        account_id: artwork.account_id,
        gallery_profile_id: artwork.gallery_profile_id ?? undefined,
      });
      if (!canEdit) {
        return { error: 'You do not have permission to edit this artwork' };
      }
    }

    // Store original title to check if it changed
    const originalTitle = artwork.title;

    // --- Provenance history snapshot ---
    // Map incoming provenance keys to their corresponding DB column names so we
    // can detect which fields actually changed and record the *previous* values.
    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      artist_name: 'artist_name',
      medium: 'medium',
      creationDate: 'creation_date',
      dimensions: 'dimensions',
      formerOwners: 'former_owners',
      auctionHistory: 'auction_history',
      exhibitionHistory: 'exhibition_history',
      historicContext: 'historic_context',
      celebrityNotes: 'celebrity_notes',
      isPublic: 'is_public',
      value: 'value',
      valueIsPublic: 'value_is_public',
      edition: 'edition',
      productionLocation: 'production_location',
      ownedBy: 'owned_by',
      ownedByIsPublic: 'owned_by_is_public',
      soldBy: 'sold_by',
      soldByIsPublic: 'sold_by_is_public',
      isSold: 'is_sold',
      displayOrder: 'display_order',
    };

    // Collect the previous values only for fields that are being updated
    const previousValues: Record<string, unknown> = {};
    for (const [incomingKey, dbColumn] of Object.entries(fieldMap)) {
      const incomingValue = provenance[incomingKey as keyof typeof provenance];
      if (incomingValue !== undefined) {
        const currentValue = artwork[dbColumn as keyof typeof artwork];
        // Only record if the value has actually changed
        if (String(currentValue ?? '') !== String(incomingValue ?? '')) {
          previousValues[incomingKey] = currentValue ?? null;
        }
      }
    }

    // Only append a snapshot entry when at least one field changed
    let updatedHistory: unknown[] = Array.isArray(artwork.provenance_history)
      ? artwork.provenance_history
      : [];

    if (Object.keys(previousValues).length > 0) {
      const snapshot = {
        editedAt: new Date().toISOString(),
        editedBy: user.id,
        previousValues,
      };
      // Append and cap at 200 entries (oldest dropped first)
      updatedHistory = [...updatedHistory, snapshot].slice(-200);
    }
    // --- End provenance history snapshot ---

    // Update title, provenance fields and privacy
    const updateData: any = {
      updated_by: user.id,
      provenance_history: updatedHistory,
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
    if (provenance.isSold !== undefined) {
      updateData.is_sold = provenance.isSold;
    }
    if (provenance.displayOrder !== undefined) {
      updateData.display_order = provenance.displayOrder ?? null;
    }

    const { error } = await (client as any)
      .from('artworks')
      .update(updateData)
      .eq('id', artworkId);

    if (error) {
      logger.error('update_provenance_update_failed', {
        artworkId,
        userId: user.id,
        error,
      });
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

            const canLink =
              exhibition?.gallery_id &&
              (await canManageExhibition(user.id, exhibition.gallery_id));

            if (exhibition && canLink) {
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
                    logger.error('update_provenance_exhibition_link_insert_failed', {
                      artworkId,
                      exhibitionId: newExhibitionId,
                      userId: user.id,
                      error: exhibitionError,
                    });
                  }
                });
            } else {
              logger.warn('update_provenance_exhibition_not_owned', {
                artworkId,
                exhibitionId: newExhibitionId,
                userId: user.id,
              });
            }
          }
        }
      } catch (exhibitionError) {
        // Don't fail the entire update if exhibition linking fails
        logger.error('update_provenance_exhibition_link_failed', {
          artworkId,
          userId: user.id,
          exhibitionId: provenance.exhibitionId ?? null,
          error: exhibitionError,
        });
      }
    }

    // Note: structured sale recording (sales_ledger + sale provenance_event) is
    // handled by markArtworkSold in src/app/artworks/[id]/_actions/mark-artwork-sold.ts.

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
        logger.error('update_provenance_notification_failed', {
          artworkId,
          userId: artwork.account_id,
          error,
        });
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
    logger.error('update_provenance_failed', {
      artworkId,
      error,
    });
    return { error: 'An unexpected error occurred' };
  }
}

