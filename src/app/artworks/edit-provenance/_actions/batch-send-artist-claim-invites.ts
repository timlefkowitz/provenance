'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  normalizeInviteEmail,
  generateClaimToken,
  hashClaimToken,
} from '~/lib/certificate-claims/tokens';
import { CERTIFICATE_TYPES, getUserRole, USER_ROLES } from '~/lib/user-roles';
import { sendBatchArtistCoaInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';
import { logger } from '~/lib/logger';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type BatchSendArtistClaimInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Creates one certificate_claim_invites record per artwork and then sends a
 * SINGLE email that lists all works and contains one "Accept all" link.
 *
 * consumeCertificateClaim already bulk-claims every artwork that matches the
 * same owner + artist_name in one go, so a single token is sufficient for
 * the artist to accept the whole batch.
 */
export async function batchSendArtistClaimInvites(
  artworkIds: string[],
  inviteEmail: string,
  senderName?: string,
): Promise<BatchSendArtistClaimInvitesResult> {
  console.log('[Collection] batchSendArtistClaimInvites started', {
    count: artworkIds.length,
    inviteEmail,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { sent: 0, errors: ['You must be signed in'] };
  }

  const normalizedEmail = normalizeInviteEmail(inviteEmail);
  if (!normalizedEmail.includes('@')) {
    return { sent: 0, errors: ['Please enter a valid artist email'] };
  }

  const adminClient = getSupabaseServerAdminClient();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  type InviteRecord = { artworkTitle: string; token: string };
  const created: InviteRecord[] = [];
  const errors: string[] = [];

  // Create one invite record per artwork — no email yet.
  for (const artworkId of artworkIds) {
    try {
      const { data: artwork, error: artworkError } = await (client as any)
        .from('artworks')
        .select('id, account_id, title, artist_name, certificate_type, certificate_status')
        .eq('id', artworkId)
        .single();

      if (artworkError || !artwork) {
        errors.push(`Artwork ${artworkId}: not found`);
        continue;
      }

      if (artwork.account_id !== user.id) {
        errors.push(`"${artwork.title}": not owned by you`);
        continue;
      }

      if (!artwork.artist_name?.trim()) {
        errors.push(`"${artwork.title}": add artist name before sending`);
        continue;
      }

      // Determine claim kind (mirrors logic in sendArtistClaimInvite)
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
        const ownerRole = getUserRole(
          ownerAccount?.public_data as Record<string, any> | null,
        );
        if (ownerRole === USER_ROLES.GALLERY || ownerRole === USER_ROLES.INSTITUTION) {
          claimKind = 'artist_coa_from_show';
        } else if (ownerRole === USER_ROLES.COLLECTOR) {
          claimKind = 'artist_coa_from_coo';
        }
      }

      if (!claimKind) {
        errors.push(
          `"${artwork.title}": must be a Certificate of Show or Certificate of Ownership`,
        );
        continue;
      }

      const token = generateClaimToken();
      const tokenHash = hashClaimToken(token);

      const { error: insertError } = await (adminClient as any)
        .from('certificate_claim_invites')
        .insert({
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
        console.error(
          '[Collection] batchSendArtistClaimInvites insert failed',
          { artworkId, error: insertError },
        );
        errors.push(`"${artwork.title}": could not create invite record`);
        continue;
      }

      created.push({ artworkTitle: artwork.title as string, token });
    } catch (err) {
      console.error(
        '[Collection] batchSendArtistClaimInvites artwork loop error',
        { artworkId, err },
      );
      errors.push(`Artwork ${artworkId}: unexpected error`);
    }
  }

  if (created.length === 0) {
    console.log('[Collection] batchSendArtistClaimInvites: no valid invites created');
    return { sent: 0, errors };
  }

  // Send ONE email. Use the first invite's token as the entry point.
  // consumeCertificateClaim auto-claims all artworks for the same artist under
  // this owner when that token is consumed, so no additional emails are needed.
  const firstToken = created[0]!.token;
  const artworkTitles = created.map((c) => c.artworkTitle);

  try {
    await sendBatchArtistCoaInviteEmail({
      to: normalizedEmail,
      recipientName: normalizedEmail.split('@')[0] || 'there',
      artworkTitles,
      token: firstToken,
      senderName,
    });
    console.log(
      '[Collection] batchSendArtistClaimInvites: single email sent',
      { artworkCount: artworkTitles.length, inviteEmail: normalizedEmail },
    );
  } catch (emailError) {
    console.error(
      '[Collection] batchSendArtistClaimInvites email failed',
      emailError,
    );
    logger.error('batch_send_artist_claim_invite_email_failed', {
      error: emailError,
      count: created.length,
    });
    errors.push('Email delivery failed — invite records were created but the email was not sent');
  }

  console.log('[Collection] batchSendArtistClaimInvites finished', {
    sent: created.length,
    errorCount: errors.length,
  });
  return { sent: created.length, errors };
}
