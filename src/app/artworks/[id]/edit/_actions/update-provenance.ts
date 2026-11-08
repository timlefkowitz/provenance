'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import {
  canEditGalleryArtworks,
  canManageExhibition,
} from '~/app/profiles/_actions/gallery-members';
import { logger } from '~/lib/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  SHARED_PROVENANCE_FIELDS,
  syncProvenanceAcrossChain,
  type ProvenanceSyncMethod,
  type SharedProvenanceField,
  type SharedProvenanceValues,
} from '~/lib/provenance/chain';
import { getAccountDisplayName } from '~/lib/certificate-claims/propagate-provenance';
import { clearToggleSale, recordSale } from '~/lib/sales/record-sale';
import { cosApprovingArtistId, splitCosContentChanges } from '~/lib/certificate-claims/cos-approval';
import { createProvenanceUpdateRequest } from '../../_actions/create-provenance-update-request';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';

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
    /** The link the editor showed before the change; replaced by exhibitionId. */
    previousExhibitionId?: string | null;
    isSold?: boolean;
    displayOrder?: number | null;
  },
  options?: {
    skipOwnershipCheck?: boolean;
    skipNotification?: boolean;
    /**
     * Client for the reads and writes, when the caller already authorized the
     * change for someone RLS wouldn't let through (an artist approving a
     * curator's change to a Certificate of Show). Server-side callers only.
     */
    dataClient?: SupabaseClient;
    /**
     * Apply content changes to a Certificate of Show directly, without the
     * artist's approval. Only for applying a change request the reviewer has
     * just approved.
     */
    skipArtistApproval?: boolean;
    /** How mirrored changes are tagged on linked certificates. */
    syncMethod?: ProvenanceSyncMethod;
  }
) {
  try {
    const authClient = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await authClient.auth.getUser();
    const client = options?.dataClient ? asUntyped(options.dataClient) : authClient;

    if (!user) {
      return { error: 'You must be signed in to update provenance' };
    }
    if (
      containsObjectionableText(
        provenance.title,
        provenance.description,
        provenance.artist_name,
        provenance.medium,
        provenance.historicContext,
        provenance.celebrityNotes,
      )
    ) {
      return { error: OBJECTIONABLE_TEXT_MESSAGE };
    }

    // Fetch current artwork state — includes all provenance fields + existing history
    const { data: artwork, error: fetchError } = await asUntyped(client)
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
        provenance_history,
        certificate_type,
        artist_account_id
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

    // A Certificate of Show issued from an artist's CoA: its content changes go
    // to the artist to approve; the holder's other changes apply directly.
    let pendingApproval = false;
    const approvingArtist = options?.skipArtistApproval ? null : cosApprovingArtistId(artwork);
    if (approvingArtist && approvingArtist !== user.id) {
      const { requestFields, remaining } = splitCosContentChanges(provenance, artwork);
      if (Object.keys(requestFields).length > 0) {
        const requestResult = await createProvenanceUpdateRequest(
          artworkId,
          requestFields,
          undefined,
          'provenance_update',
        );
        if (!requestResult.success) {
          return { error: requestResult.error || 'Could not send the changes to the artist' };
        }
        pendingApproval = true;
      }
      provenance = remaining;
      if (Object.values(provenance).every((v) => v === undefined)) {
        revalidatePath(`/artworks/${artworkId}/certificate`);
        revalidatePath('/portal');
        return { success: true, pendingApproval };
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

    const { error } = await asUntyped(client)
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
        // A work can be in several shows. Replace the link the editor showed
        // (previousExhibitionId), or the only link when there is just one,
        // and leave the work's other shows alone.
        const { data: currentLinks } = await asUntyped(client)
          .from('exhibition_artworks')
          .select('exhibition_id')
          .eq('artwork_id', artworkId);

        const linkedIds = ((currentLinks ?? []) as { exhibition_id: string | null }[])
          .map((l) => l.exhibition_id)
          .filter((id): id is string => Boolean(id));
        const newExhibitionId = provenance.exhibitionId || null;
        const currentExhibitionId =
          provenance.previousExhibitionId !== undefined
            ? provenance.previousExhibitionId && linkedIds.includes(provenance.previousExhibitionId)
              ? provenance.previousExhibitionId
              : null
            : linkedIds.length === 1
              ? linkedIds[0]!
              : null;
        const alreadyLinked = Boolean(newExhibitionId && linkedIds.includes(newExhibitionId));

        // Only update if the exhibition has changed
        if (currentExhibitionId !== newExhibitionId) {
          // Remove from current exhibition if linked
          if (currentExhibitionId) {
            await asUntyped(client)
              .from('exhibition_artworks')
              .delete()
              .eq('artwork_id', artworkId)
              .eq('exhibition_id', currentExhibitionId);
          }

          // Add to new exhibition if provided
          if (newExhibitionId && !alreadyLinked) {
            // Verify the user owns this exhibition
            const { data: exhibition } = await asUntyped(client)
              .from('exhibitions')
              .select('gallery_id')
              .eq('id', newExhibitionId)
              .single();

            const canLink =
              exhibition?.gallery_id &&
              (await canManageExhibition(user.id, exhibition.gallery_id));

            if (exhibition && canLink) {
              // Add artwork to exhibition (ignore duplicate errors)
              const { error: exhibitionError } = await asUntyped(client)
                .from('exhibition_artworks')
                .insert({
                  exhibition_id: newExhibitionId,
                  artwork_id: artworkId,
                });
              // Ignore duplicate key errors
              if (exhibitionError && exhibitionError.code !== '23505') {
                logger.error('update_provenance_exhibition_link_insert_failed', {
                  artworkId,
                  exhibitionId: newExhibitionId,
                  userId: user.id,
                  error: exhibitionError,
                });
              }
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

    // Mirror shared provenance fields (owner, former owners, exhibition
    // history, ...) to every linked certificate, tagged "via <cert> · edited".
    // Only the fields this edit actually changed are written.
    const admin = getSupabaseServerAdminClient();
    const sharedChanges: SharedProvenanceValues = {};
    for (const [incomingKey, dbColumn] of Object.entries(fieldMap)) {
      if (
        incomingKey in previousValues &&
        (SHARED_PROVENANCE_FIELDS as readonly string[]).includes(dbColumn)
      ) {
        sharedChanges[dbColumn as SharedProvenanceField] = updateData[dbColumn] ?? null;
      }
    }
    if (Object.keys(sharedChanges).length > 0) {
      await syncProvenanceAcrossChain(admin, {
        originArtworkId: artworkId,
        fields: sharedChanges,
        method: options?.syncMethod ?? 'edit',
        actorAccountId: user.id,
        actorName: await getAccountDisplayName(admin, user.id),
      });
    }

    // The "sold" toggle goes through the sales ledger so the sale reaches
    // collectors and sales analytics; undo removes the toggle's ledger row.
    if ('isSold' in previousValues) {
      if (provenance.isSold) {
        await recordSale(admin, {
          artworkId,
          recordedBy: user.id,
          metadata: { source: 'sold_toggle' },
        });
      } else {
        await clearToggleSale(admin, artworkId);
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
            updated_fields: Object.keys(provenance).filter(key => key !== 'previousExhibitionId' && provenance[key as keyof typeof provenance] !== undefined),
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
    
    const exhibitionDisplayFieldsChanged =
      provenance.artist_name !== undefined ||
      provenance.title !== undefined ||
      provenance.dimensions !== undefined ||
      provenance.exhibitionId !== undefined;

    if (exhibitionDisplayFieldsChanged) {
      try {
        const { data: exhibitionLinks } = await asUntyped(client)
          .from('exhibition_artworks')
          .select('exhibition_id')
          .eq('artwork_id', artworkId);

        const linkedExhibitionIds = Array.from(
          new Set(
            (exhibitionLinks || [])
              .map((row: { exhibition_id?: string | null }) => row.exhibition_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        if (linkedExhibitionIds.length > 0) {
          revalidatePath('/exhibitions');
          for (const linkedExhibitionId of linkedExhibitionIds) {
            revalidatePath(`/exhibitions/${linkedExhibitionId}`);
          }
        } else if (provenance.exhibitionId !== undefined) {
          revalidatePath('/exhibitions');
        }
      } catch (revalidateErr) {
        logger.error('update_provenance_exhibition_revalidate_failed', {
          artworkId,
          error: revalidateErr,
        });
      }

      if (artwork.account_id) {
        revalidatePath(`/artists/${artwork.account_id}`);
      }
    }

    return { success: true, pendingApproval };
  } catch (error) {
    logger.error('update_provenance_failed', {
      artworkId,
      error,
    });
    return { error: 'An unexpected error occurred' };
  }
}

