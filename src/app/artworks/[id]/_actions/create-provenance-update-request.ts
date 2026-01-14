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
};

export async function createProvenanceUpdateRequest(
  artworkId: string,
  updateFields: ProvenanceUpdateFields,
  requestMessage?: string,
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
      .select('id, account_id, title')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    // Don't allow requesting updates to your own artwork
    if (artwork.account_id === user.id) {
      return { success: false, error: 'You cannot request updates to your own artwork' };
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await (client as any)
      .from('provenance_update_requests')
      .select('id')
      .eq('artwork_id', artworkId)
      .eq('requested_by', user.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return { success: false, error: 'You already have a pending update request for this artwork' };
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
      });

    if (insertError) {
      console.error('Error creating provenance update request:', insertError);
      return { success: false, error: 'Failed to create update request' };
    }

    // Create notification for artwork owner
    try {
      await createNotification({
        userId: artwork.account_id,
        type: 'provenance_update_request',
        title: `Provenance Update Request: ${artwork.title}`,
        message: `A user has requested to update the provenance information for "${artwork.title}". Review the request in your portal.`,
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

