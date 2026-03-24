import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { generateClaimToken, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { sendArtistCoaInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type ArtistClaimInviteParams = {
  sourceArtwork: Record<string, unknown>;
  provenanceUpdateRequestId: string;
  /** From request.update_fields.invite_email or resolved from account */
  inviteeEmail: string;
  reviewerUserId: string;
};

/**
 * After owner approves artist_claim: persist invite and send email. CoA is created when invite is consumed.
 */
export async function createArtistClaimInviteAfterApproval(
  params: ArtistClaimInviteParams,
): Promise<{ success: boolean; error?: string }> {
  const source = params.sourceArtwork;
  const sourceId = source.id as string;
  const certType = (source.certificate_type as string) || 'authenticity';

  let claimKind: 'artist_coa_from_show' | 'artist_coa_from_coo';
  if (certType === CERTIFICATE_TYPES.SHOW) {
    claimKind = 'artist_coa_from_show';
  } else if (certType === CERTIFICATE_TYPES.OWNERSHIP) {
    claimKind = 'artist_coa_from_coo';
  } else {
    return { success: false, error: 'Invalid certificate type for artist claim' };
  }

  const inviteeEmail = normalizeInviteEmail(params.inviteeEmail);
  if (!inviteeEmail.includes('@')) {
    return { success: false, error: 'Invalid invite email for artist claim' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const token = generateClaimToken();
  const tokenHash = hashClaimToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { error: insertError } = await (adminClient as any).from('certificate_claim_invites').insert({
    source_artwork_id: sourceId,
    claim_kind: claimKind,
    invitee_email: inviteeEmail,
    token_hash: tokenHash,
    status: 'sent',
    expires_at: expiresAt,
    created_by: params.reviewerUserId,
    provenance_update_request_id: params.provenanceUpdateRequestId,
  });

  if (insertError) {
    console.error('[Certificates] createArtistClaimInviteAfterApproval insert failed', insertError);
    logger.error('artist_claim_invite_insert_failed', { sourceId, error: insertError });
    return { success: false, error: 'Failed to create claim invite' };
  }

  const title = (source.title as string) || 'Your artwork';

  try {
    await sendArtistCoaInviteEmail({
      to: inviteeEmail,
      recipientName: inviteeEmail.split('@')[0] || 'there',
      artworkTitle: title,
      token,
    });
  } catch (emailErr) {
    console.error('[Certificates] createArtistClaimInviteAfterApproval email failed', emailErr);
    logger.error('artist_claim_invite_email_failed', { sourceId, error: emailErr });
  }

  console.log('[Certificates] createArtistClaimInviteAfterApproval sent', { sourceId });
  return { success: true };
}
