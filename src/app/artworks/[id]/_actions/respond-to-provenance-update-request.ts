'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { updateProvenance } from '../edit/_actions/update-provenance';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

export async function respondToProvenanceUpdateRequest(
  requestId: string,
  action: 'approve' | 'deny',
  reviewMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in' };
    }

    // Get the request and verify ownership
    const { data: request, error: requestError } = await (client as any)
      .from('provenance_update_requests')
      .select(`
        *,
        artworks!inner (
          id,
          account_id,
          title,
          artist_name
        )
      `)
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return { success: false, error: 'Request not found or already processed' };
    }

    // Verify user owns the artwork
    if (request.artworks.account_id !== user.id) {
      return { success: false, error: 'You do not have permission to review this request' };
    }

    if (action === 'approve') {
      // Handle artist claim: create artist's CoA, link to source, notify other certs
      if (request.request_type === 'artist_claim') {
        const adminClient = getSupabaseServerAdminClient();
        const { data: sourceArtwork, error: sourceError } = await (client as any)
          .from('artworks')
          .select('*')
          .eq('id', request.artworks.id)
          .single();

        if (sourceError || !sourceArtwork) {
          logger.error('artist_claim_source_artwork_fetch_failed', { requestId, error: sourceError });
          return { success: false, error: 'Could not load certificate' };
        }

        const certNumber = await generateCertificateNumber(client);
        const now = new Date().toISOString();
        const artistId = request.requested_by;

        const { data: newArtwork, error: insertError } = await (adminClient as any)
          .from('artworks')
          .insert({
            account_id: artistId,
            title: sourceArtwork.title,
            description: sourceArtwork.description,
            artist_name: sourceArtwork.artist_name,
            creation_date: sourceArtwork.creation_date,
            medium: sourceArtwork.medium,
            dimensions: sourceArtwork.dimensions,
            image_url: sourceArtwork.image_url,
            former_owners: sourceArtwork.former_owners,
            auction_history: sourceArtwork.auction_history,
            exhibition_history: sourceArtwork.exhibition_history,
            historic_context: sourceArtwork.historic_context,
            celebrity_notes: sourceArtwork.celebrity_notes,
            value: sourceArtwork.value,
            value_is_public: sourceArtwork.value_is_public,
            edition: sourceArtwork.edition,
            production_location: sourceArtwork.production_location,
            owned_by: sourceArtwork.owned_by,
            owned_by_is_public: sourceArtwork.owned_by_is_public,
            sold_by: sourceArtwork.sold_by,
            sold_by_is_public: sourceArtwork.sold_by_is_public,
            metadata: sourceArtwork.metadata || {},
            certificate_number: certNumber,
            certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
            source_artwork_id: sourceArtwork.id,
            artist_account_id: artistId,
            status: 'verified',
            certificate_status: 'verified',
            created_by: user.id,
            updated_by: user.id,
          })
          .select('id')
          .single();

        if (insertError || !newArtwork) {
          logger.error('artist_claim_create_coa_failed', { requestId, error: insertError });
          return { success: false, error: 'Failed to create Certificate of Authenticity for the artist' };
        }

        const { error: updateSourceError } = await (client as any)
          .from('artworks')
          .update({
            artist_account_id: artistId,
            certificate_status: 'verified',
            claimed_by_artist_at: now,
            verified_by_owner_at: now,
            updated_by: user.id,
          })
          .eq('id', sourceArtwork.id);

        if (updateSourceError) {
          logger.error('artist_claim_update_source_failed', { requestId, error: updateSourceError });
          // CoA already created; don't fail the whole flow
        }

        try {
          await createNotification({
            userId: artistId,
            type: 'artist_claim_approved',
            title: `Claim accepted: ${sourceArtwork.title}`,
            message: `Your claim as artist for "${sourceArtwork.title}" was accepted. You now have a Certificate of Authenticity linked to this work.`,
            artworkId: newArtwork.id,
            relatedUserId: user.id,
            metadata: { source_artwork_id: sourceArtwork.id },
          });
        } catch (notifErr) {
          logger.error('artist_claim_notification_artist_failed', { requestId, error: notifErr });
        }

        const { data: otherCerts } = await (client as any)
          .from('artworks')
          .select('id, title')
          .eq('account_id', user.id)
          .eq('artist_name', sourceArtwork.artist_name)
          .in('certificate_type', [CERTIFICATE_TYPES.SHOW, CERTIFICATE_TYPES.OWNERSHIP])
          .neq('id', sourceArtwork.id);

        if (otherCerts && otherCerts.length > 0) {
          try {
            await createNotification({
              userId: user.id,
              type: 'artist_claim_other_certificates',
              title: `Add more certificates for ${sourceArtwork.artist_name}`,
              message: `An artist claim was accepted for "${sourceArtwork.title}". You have ${otherCerts.length} other certificate(s) for this artist that you can add to their profile from your portal.`,
              artworkId: sourceArtwork.id,
              relatedUserId: artistId,
              metadata: { other_artwork_ids: otherCerts.map((a: any) => a.id) },
            });
          } catch (notifErr) {
            logger.error('artist_claim_notification_owner_other_failed', { requestId, error: notifErr });
          }
        }
      } else if (request.request_type === 'ownership_request') {
        // Transfer ownership to the requester
        const { error: transferError } = await (client as any)
          .from('artworks')
          .update({
            account_id: request.requested_by,
            updated_by: user.id,
          })
          .eq('id', request.artworks.id);

        if (transferError) {
          logger.error('provenance_request_transfer_ownership_failed', {
            requestId,
            artworkId: request.artworks.id,
            requestedBy: request.requested_by,
            reviewerId: user.id,
            error: transferError,
          });
          return { success: false, error: 'Failed to transfer ownership' };
        }
      } else {
        // Handle image_url and created_at directly if present
        if (request.update_fields.image_url !== undefined) {
          const { error: imageUpdateError } = await (client as any)
            .from('artworks')
            .update({ image_url: request.update_fields.image_url })
            .eq('id', request.artworks.id);

          if (imageUpdateError) {
            logger.error('provenance_request_update_image_failed', {
              requestId,
              artworkId: request.artworks.id,
              reviewerId: user.id,
              error: imageUpdateError,
            });
            return { success: false, error: 'Failed to update image' };
          }
        }

        if (request.update_fields.created_at !== undefined) {
          const { error: dateUpdateError } = await (client as any)
            .from('artworks')
            .update({ created_at: request.update_fields.created_at })
            .eq('id', request.artworks.id);

          if (dateUpdateError) {
            logger.error('provenance_request_update_date_failed', {
              requestId,
              artworkId: request.artworks.id,
              reviewerId: user.id,
              error: dateUpdateError,
            });
            return { success: false, error: 'Failed to update date' };
          }
        }

        // Format update fields to match updateProvenance function signature
        const formattedUpdates: any = {};
        
        if (request.update_fields.title !== undefined) formattedUpdates.title = request.update_fields.title;
        if (request.update_fields.description !== undefined) formattedUpdates.description = request.update_fields.description;
        if (request.update_fields.artist_name !== undefined) formattedUpdates.artist_name = request.update_fields.artist_name;
        if (request.update_fields.medium !== undefined) formattedUpdates.medium = request.update_fields.medium;
        if (request.update_fields.creation_date !== undefined) formattedUpdates.creationDate = request.update_fields.creation_date;
        if (request.update_fields.dimensions !== undefined) formattedUpdates.dimensions = request.update_fields.dimensions;
        if (request.update_fields.former_owners !== undefined) formattedUpdates.formerOwners = request.update_fields.former_owners;
        if (request.update_fields.auction_history !== undefined) formattedUpdates.auctionHistory = request.update_fields.auction_history;
        if (request.update_fields.exhibition_history !== undefined) formattedUpdates.exhibitionHistory = request.update_fields.exhibition_history;
        if (request.update_fields.historic_context !== undefined) formattedUpdates.historicContext = request.update_fields.historic_context;
        if (request.update_fields.celebrity_notes !== undefined) formattedUpdates.celebrityNotes = request.update_fields.celebrity_notes;
        if (request.update_fields.value !== undefined) formattedUpdates.value = request.update_fields.value;
        if (request.update_fields.edition !== undefined) formattedUpdates.edition = request.update_fields.edition;
        if (request.update_fields.production_location !== undefined) formattedUpdates.productionLocation = request.update_fields.production_location;
        if (request.update_fields.owned_by !== undefined) formattedUpdates.ownedBy = request.update_fields.owned_by;
        if (request.update_fields.sold_by !== undefined) formattedUpdates.soldBy = request.update_fields.sold_by;
        if (request.update_fields.exhibitionId !== undefined) formattedUpdates.exhibitionId = request.update_fields.exhibitionId;

        // Handle exhibition updates if present
        if (request.update_fields.exhibitionId && 
            request.update_fields.exhibitionId !== '__none__' && 
            request.update_fields.exhibitionTitle) {
          // Verify the artwork owner owns this exhibition (or the requester owns it)
          const { data: exhibition } = await (client as any)
            .from('exhibitions')
            .select('gallery_id')
            .eq('id', request.update_fields.exhibitionId)
            .single();

          if (exhibition && (exhibition.gallery_id === user.id || exhibition.gallery_id === request.requested_by)) {
            const exhibitionUpdate: any = {
              title: request.update_fields.exhibitionTitle.trim(),
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            };

            if (request.update_fields.exhibitionStartDate) {
              exhibitionUpdate.start_date = request.update_fields.exhibitionStartDate;
            }
            if (request.update_fields.exhibitionEndDate) {
              exhibitionUpdate.end_date = request.update_fields.exhibitionEndDate;
            }
            if (request.update_fields.exhibitionLocation) {
              exhibitionUpdate.location = request.update_fields.exhibitionLocation.trim();
            }
            if (request.update_fields.exhibitionGalleryId) {
              exhibitionUpdate.gallery_id = request.update_fields.exhibitionGalleryId;
            }

            const { error: exhibitionUpdateError } = await (client as any)
              .from('exhibitions')
              .update(exhibitionUpdate)
              .eq('id', request.update_fields.exhibitionId);

            if (exhibitionUpdateError) {
            logger.error('provenance_request_update_exhibition_failed', {
              requestId,
              artworkId: request.artworks.id,
              exhibitionId: request.update_fields.exhibitionId,
              reviewerId: user.id,
              error: exhibitionUpdateError,
            });
              // Don't fail the entire request if exhibition update fails
            }
          }
        }

        // Apply the updates to the artwork (skip ownership check and notification since we handle those here)
        if (Object.keys(formattedUpdates).length > 0) {
          const updateResult = await updateProvenance(
            request.artworks.id,
            formattedUpdates,
            {
              skipOwnershipCheck: true,
              skipNotification: true,
            },
          );

          if (updateResult.error) {
            return { success: false, error: updateResult.error };
          }
        }
      }

      // Update the request status
      const { error: updateError } = await (client as any)
        .from('provenance_update_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_message: reviewMessage || null,
        })
        .eq('id', requestId);

      if (updateError) {
        logger.error('provenance_request_status_update_failed', {
          requestId,
          newStatus: 'approved',
          reviewerId: user.id,
          error: updateError,
        });
        return { success: false, error: 'Failed to update request status' };
      }

      // Create notification for requester (skip for artist_claim; we already notified in the block)
      if (request.request_type !== 'artist_claim') {
        try {
          const notificationType = request.request_type === 'ownership_request' ? 'ownership_approved' : 'provenance_update_approved';
          const notificationTitle = request.request_type === 'ownership_request'
            ? `Ownership Approved: ${request.artworks.title}`
            : `Update Approved: ${request.artworks.title}`;
          const notificationMessage = request.request_type === 'ownership_request'
            ? `Your ownership request for "${request.artworks.title}" has been approved. You are now the owner of this artwork.`
            : `Your provenance update request for "${request.artworks.title}" has been approved.`;

          await createNotification({
            userId: request.requested_by,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            artworkId: request.artworks.id,
            relatedUserId: user.id,
          });
        } catch (notifError) {
          logger.error('provenance_request_notification_failed', {
            requestId,
            requestType: request.request_type,
            outcome: 'approved',
            reviewerId: user.id,
            requestedBy: request.requested_by,
            error: notifError,
          });
        }
      }
    } else {
      // Deny the request
      const { error: updateError } = await (client as any)
        .from('provenance_update_requests')
        .update({
          status: 'denied',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_message: reviewMessage || null,
        })
        .eq('id', requestId);

      if (updateError) {
        logger.error('provenance_request_status_update_failed', {
          requestId,
          newStatus: 'denied',
          reviewerId: user.id,
          error: updateError,
        });
        return { success: false, error: 'Failed to update request status' };
      }

      // Create notification for requester
      try {
        const notificationType = request.request_type === 'ownership_request'
          ? 'ownership_denied'
          : request.request_type === 'artist_claim'
            ? 'artist_claim_denied'
            : 'provenance_update_denied';
        const notificationTitle = request.request_type === 'ownership_request'
          ? `Ownership Denied: ${request.artworks.title}`
          : request.request_type === 'artist_claim'
            ? `Claim as artist denied: ${request.artworks.title}`
            : `Update Denied: ${request.artworks.title}`;
        const notificationMessage = request.request_type === 'ownership_request'
          ? `Your ownership request for "${request.artworks.title}" has been denied.`
          : request.request_type === 'artist_claim'
            ? `Your claim as artist for "${request.artworks.title}" has been denied.`
            : `Your provenance update request for "${request.artworks.title}" has been denied.`;

        await createNotification({
          userId: request.requested_by,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          artworkId: request.artworks.id,
          relatedUserId: user.id,
        });
      } catch (notifError) {
        logger.error('provenance_request_notification_failed', {
          requestId,
          requestType: request.request_type,
          outcome: 'denied',
          reviewerId: user.id,
          requestedBy: request.requested_by,
          error: notifError,
        });
      }
    }

    revalidatePath('/portal');
    revalidatePath(`/artworks/${request.artworks.id}/certificate`);

    return { success: true };
  } catch (error: any) {
    logger.error('provenance_request_respond_failed', {
      requestId,
      action,
      error,
    });
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

async function generateCertificateNumber(client: any): Promise<string> {
  try {
    const { data, error } = await client.rpc('generate_certificate_number');
    if (!error && data) return data;
  } catch (err) {
    logger.error('generate_certificate_number_failed', { error: err });
  }
  let certificateNumber: string;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    certificateNumber = `PROV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data } = await client.from('artworks').select('id').eq('certificate_number', certificateNumber).single();
    exists = !!data;
    attempts++;
  }
  if (exists) throw new Error('Failed to generate unique certificate number');
  return certificateNumber!;
}

