'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { updateProvenance } from '../edit/_actions/update-provenance';

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
      // Handle ownership transfer if this is an ownership request
      if (request.request_type === 'ownership_request') {
        // Transfer ownership to the requester
        const { error: transferError } = await (client as any)
          .from('artworks')
          .update({
            account_id: request.requested_by,
            updated_by: user.id,
          })
          .eq('id', request.artworks.id);

        if (transferError) {
          console.error('Error transferring ownership:', transferError);
          return { success: false, error: 'Failed to transfer ownership' };
        }
      } else {
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

        // Apply the updates to the artwork (skip ownership check and notification since we handle those here)
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
        console.error('Error updating request status:', updateError);
        return { success: false, error: 'Failed to update request status' };
      }

      // Create notification for requester
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
        console.error('Error creating notification:', notifError);
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
        console.error('Error updating request status:', updateError);
        return { success: false, error: 'Failed to update request status' };
      }

      // Create notification for requester
      try {
        const notificationType = request.request_type === 'ownership_request' ? 'ownership_denied' : 'provenance_update_denied';
        const notificationTitle = request.request_type === 'ownership_request'
          ? `Ownership Denied: ${request.artworks.title}`
          : `Update Denied: ${request.artworks.title}`;
        const notificationMessage = request.request_type === 'ownership_request'
          ? `Your ownership request for "${request.artworks.title}" has been denied.`
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
        console.error('Error creating notification:', notifError);
      }
    }

    revalidatePath('/portal');
    revalidatePath(`/artworks/${request.artworks.id}/certificate`);

    return { success: true };
  } catch (error: any) {
    console.error('Error in respondToProvenanceUpdateRequest:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

