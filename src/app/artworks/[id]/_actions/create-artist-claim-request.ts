'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';

/**
 * Artist claims a Certificate of Show or Certificate of Ownership as the artist of the work.
 * The certificate owner is notified and can approve; on approval we email the artist to
 * complete their Certificate of Authenticity (linked to this certificate).
 *
 * @param inviteEmail — email that will receive the completion link (defaults to your account email)
 */
export async function createArtistClaimRequest(
  artworkId: string,
  inviteEmail?: string | null,
): Promise<{ success: boolean; error?: string }> {
  console.log('[ArtistClaim] createArtistClaimRequest started', { artworkId });
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to claim as artist' };
    }

    const { data: account } = await client
      .from('accounts')
      .select('id, name, public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.ARTIST) {
      return { success: false, error: 'Only artists can claim certificates as artist' };
    }

    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, artist_name, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[ArtistClaim] artwork not found', { artworkId, error: artworkError });
      return { success: false, error: 'Artwork not found' };
    }

    const certType = artwork.certificate_type || 'authenticity';
    if (certType !== CERTIFICATE_TYPES.SHOW && certType !== CERTIFICATE_TYPES.OWNERSHIP) {
      return { success: false, error: 'Only Certificate of Show or Certificate of Ownership can be claimed as artist' };
    }

    if (artwork.account_id === user.id) {
      return { success: false, error: 'You cannot claim your own certificate' };
    }

    if (!artwork.artist_name || account.name.toLowerCase() !== artwork.artist_name.toLowerCase()) {
      return { success: false, error: 'Your name must match the artist name on the certificate to claim as artist' };
    }

    const sessionEmail = user.email ? normalizeInviteEmail(user.email) : '';
    const resolvedInviteEmail = inviteEmail?.trim()
      ? normalizeInviteEmail(inviteEmail)
      : sessionEmail;

    if (!resolvedInviteEmail || !resolvedInviteEmail.includes('@')) {
      return { success: false, error: 'Provide an email address to receive your certificate completion link' };
    }

    const { data: existingRequest } = await (client as any)
      .from('provenance_update_requests')
      .select('id')
      .eq('artwork_id', artworkId)
      .eq('requested_by', user.id)
      .eq('status', 'pending')
      .eq('request_type', 'artist_claim')
      .single();

    if (existingRequest) {
      return { success: false, error: 'You already have a pending claim as artist request for this certificate' };
    }

    const { error: insertError } = await (client as any)
      .from('provenance_update_requests')
      .insert({
        artwork_id: artworkId,
        requested_by: user.id,
        update_fields: { invite_email: resolvedInviteEmail },
        request_message: null,
        status: 'pending',
        request_type: 'artist_claim',
      });

    if (insertError) {
      logger.error('artist_claim_request_insert_failed', {
        artworkId,
        requestedBy: user.id,
        error: insertError,
      });
      return { success: false, error: 'Failed to submit claim' };
    }

    try {
      await createNotification({
        userId: artwork.account_id,
        type: 'artist_claim_request',
        title: `Artist claim: ${artwork.title}`,
        message: `${account.name || 'An artist'} is claiming to be the artist of "${artwork.title}". Review the request in your portal to accept. If you accept, they will receive an email to complete their Certificate of Authenticity linked to this certificate.`,
        artworkId: artwork.id,
        relatedUserId: user.id,
      });
    } catch (notifError) {
      logger.error('artist_claim_request_notification_failed', {
        artworkId,
        requestedBy: user.id,
        ownerId: artwork.account_id,
        error: notifError,
      });
    }

    console.log('[ArtistClaim] createArtistClaimRequest success', { artworkId });
    return { success: true };
  } catch (error: any) {
    console.error('[ArtistClaim] createArtistClaimRequest failed', error);
    logger.error('artist_claim_request_failed', { artworkId, error });
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
