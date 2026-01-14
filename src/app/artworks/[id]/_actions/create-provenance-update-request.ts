'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createNotification } from '~/lib/notifications';

export type ProvenanceUpdateFields = {
  title?: string;
  description?: string;
  artist_name?: string;
  medium?: string;
  dimensions?: string;
  creation_date?: string;
  former_owners?: string;
  auction_history?: string;
  exhibition_history?: string;
  historic_context?: string;
  celebrity_notes?: string;
  value?: string;
  edition?: string;
  production_location?: string;
  owned_by?: string;
  sold_by?: string;
};

export async function createProvenanceUpdateRequest(
  artworkId: string,
  updateFields: ProvenanceUpdateFields,
  requestMessage?: string,
  requestType: 'provenance_update' | 'ownership_request' = 'provenance_update',
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to request an update' };
    }

    // Verify artwork exists and get owner
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, artist_name')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    // For ownership requests, verify user is an artist and matches the artwork's artist_name
    if (requestType === 'ownership_request') {
      const { data: account } = await client
        .from('accounts')
        .select('id, name, public_data')
        .eq('id', user.id)
        .single();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      const { getUserRole } = await import('~/lib/user-roles');
      const { USER_ROLES } = await import('~/lib/user-roles');
      const userRole = getUserRole(account.public_data as Record<string, any>);
      
      if (userRole !== USER_ROLES.ARTIST) {
        return { success: false, error: 'Only artists can request ownership' };
      }

      // Check if artist name matches (case-insensitive)
      if (!artwork.artist_name || account.name.toLowerCase() !== artwork.artist_name.toLowerCase()) {
        return { success: false, error: 'Your name must match the artist name on the artwork to request ownership' };
      }

      // Don't allow requesting ownership if already the owner
      if (artwork.account_id === user.id) {
        return { success: false, error: 'You already own this artwork' };
      }
    } else {
      // For provenance updates, don't allow requesting updates to your own artwork
      if (artwork.account_id === user.id) {
        return { success: false, error: 'You cannot request updates to your own artwork' };
      }
    }

    // Check if there's already a pending request of the same type
    const { data: existingRequest } = await (client as any)
      .from('provenance_update_requests')
      .select('id')
      .eq('artwork_id', artworkId)
      .eq('requested_by', user.id)
      .eq('status', 'pending')
      .eq('request_type', requestType)
      .single();

    if (existingRequest) {
      const requestTypeLabel = requestType === 'ownership_request' ? 'ownership' : 'update';
      return { success: false, error: `You already have a pending ${requestTypeLabel} request for this artwork` };
    }

    // Create the request
    const { error: insertError } = await (client as any)
      .from('provenance_update_requests')
      .insert({
        artwork_id: artworkId,
        requested_by: user.id,
        update_fields: updateFields,
        request_message: requestMessage || null,
        status: 'pending',
        request_type: requestType,
      });

    if (insertError) {
      console.error('Error creating provenance update request:', insertError);
      return { success: false, error: 'Failed to create update request' };
    }

    // Create notification for artwork owner
    try {
      const notificationType: 'ownership_request' | 'provenance_update_request' = requestType === 'ownership_request' ? 'ownership_request' : 'provenance_update_request';
      const notificationTitle = requestType === 'ownership_request' 
        ? `Ownership Request: ${artwork.title}`
        : `Provenance Update Request: ${artwork.title}`;
      const notificationMessage = requestType === 'ownership_request'
        ? `An artist has requested ownership of "${artwork.title}". Review the request in your portal.`
        : `A user has requested to update the provenance information for "${artwork.title}". Review the request in your portal.`;

      await createNotification({
        userId: artwork.account_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        artworkId: artwork.id,
        relatedUserId: user.id,
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request if notification fails
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in createProvenanceUpdateRequest:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

