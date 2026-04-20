'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { normalizeInviteEmail, generateClaimToken, hashClaimToken } from '~/lib/certificate-claims/tokens';
import { CERTIFICATE_TYPES, USER_ROLES, getUserRole } from '~/lib/user-roles';
import { sendArtistCoaInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';
import { logger } from '~/lib/logger';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function sendArtistClaimInvite(
  artworkId: string,
  inviteEmail: string,
  senderName?: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[Certificates] sendArtistClaimInvite started', { artworkId });
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in' };
    }

    const normalizedEmail = normalizeInviteEmail(inviteEmail);
    if (!normalizedEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid artist email' };
    }

    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, artist_name, certificate_type, certificate_status')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[Certificates] sendArtistClaimInvite artwork lookup failed', artworkError);
      return { success: false, error: 'Certificate not found' };
    }

    if (artwork.account_id !== user.id) {
      return { success: false, error: 'Only the certificate owner can send this invite' };
    }

    // Primary path: use the stored certificate_type.
    // Fallback: for legacy rows where certificate_type is missing or set to
    // 'authenticity' but the record is clearly pending an artist claim, derive
    // the claim kind from the owner account's role so gallery/collector
    // uploads from before the role-aware logic still work.
    const certType = artwork.certificate_type || 'authenticity';
    let claimKind: 'artist_coa_from_show' | 'artist_coa_from_coo' | null = null;

    if (certType === CERTIFICATE_TYPES.SHOW) {
      claimKind = 'artist_coa_from_show';
    } else if (certType === CERTIFICATE_TYPES.OWNERSHIP) {
      claimKind = 'artist_coa_from_coo';
    } else if (artwork.certificate_status === 'pending_artist_claim') {
      const { data: ownerAccount } = await (client as any)
        .from('accounts')
        .select('public_data')
        .eq('id', artwork.account_id)
        .single();
      const ownerRole = getUserRole(ownerAccount?.public_data as Record<string, any> | null);
      if (ownerRole === USER_ROLES.GALLERY || ownerRole === USER_ROLES.INSTITUTION) {
        claimKind = 'artist_coa_from_show';
      } else if (ownerRole === USER_ROLES.COLLECTOR) {
        claimKind = 'artist_coa_from_coo';
      }
    }

    if (!claimKind) {
      return {
        success: false,
        error: 'Artist claim invite can only be sent from a Certificate of Show or Certificate of Ownership',
      };
    }

    if (!artwork.artist_name?.trim()) {
      return { success: false, error: 'Add the artist name before sending a claim invite' };
    }

    console.log('[Certificates] sendArtistClaimInvite creating invite', { artworkId, claimKind });
    const adminClient = getSupabaseServerAdminClient();
    const token = generateClaimToken();
    const tokenHash = hashClaimToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error: insertError } = await (adminClient as any).from('certificate_claim_invites').insert({
      source_artwork_id: artworkId,
      claim_kind: claimKind,
      invitee_email: normalizedEmail,
      token_hash: tokenHash,
      status: 'sent',
      expires_at: expiresAt,
      created_by: user.id,
      provenance_update_request_id: null,
    });

    if (insertError) {
      console.error('[Certificates] sendArtistClaimInvite insert failed', insertError);
      logger.error('send_artist_claim_invite_insert_failed', { artworkId, userId: user.id, error: insertError });
      return { success: false, error: 'Could not create claim invite' };
    }

    try {
      console.log('[Certificates] sendArtistClaimInvite sending email', { artworkId });
      await sendArtistCoaInviteEmail({
        to: normalizedEmail,
        recipientName: normalizedEmail.split('@')[0] || 'there',
        artworkTitle: artwork.title || 'Your artwork',
        token,
        senderName,
      });
    } catch (emailError) {
      console.error('[Certificates] sendArtistClaimInvite email failed', emailError);
      logger.error('send_artist_claim_invite_email_failed', { artworkId, userId: user.id, error: emailError });
    }

    console.log('[Certificates] sendArtistClaimInvite success', { artworkId });
    return { success: true };
  } catch (error) {
    console.error('[Certificates] sendArtistClaimInvite failed', error);
    logger.error('send_artist_claim_invite_failed', { artworkId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite',
    };
  }
}
