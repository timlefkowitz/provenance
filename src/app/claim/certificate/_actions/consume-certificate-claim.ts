'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { hashClaimToken, emailsMatch, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import {
  insertLinkedCertificateOfOwnershipFromCoa,
  insertArtistCoaFromSourceCertificate,
} from '~/lib/certificate-claims/insert-linked-certificate';

export type ConsumeCertificateClaimResult =
  | { success: true; artworkId: string }
  | { success: false; error: string };

export async function consumeCertificateClaim(token: string): Promise<ConsumeCertificateClaimResult> {
  console.log('[Certificates] consumeCertificateClaim started');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to claim this certificate' };
    }

    const userEmail = user.email;
    if (!userEmail) {
      console.error('[Certificates] consumeCertificateClaim: no email on session', { userId: user.id });
      return { success: false, error: 'Your account has no email; add one to complete this claim' };
    }

    const trimmed = token?.trim();
    if (!trimmed) {
      return { success: false, error: 'Invalid or missing claim link' };
    }

    const tokenHash = hashClaimToken(trimmed);
    const adminClient = getSupabaseServerAdminClient();

    const { data: invite, error: inviteError } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invite) {
      console.error('[Certificates] consumeCertificateClaim invite lookup failed', inviteError);
      return { success: false, error: 'Invalid or expired claim link' };
    }

    if (invite.status === 'consumed' && invite.result_artwork_id) {
      revalidatePath(`/artworks/${invite.result_artwork_id}/certificate`);
      return { success: true, artworkId: invite.result_artwork_id as string };
    }

    if (invite.status === 'cancelled' || invite.status === 'expired') {
      return { success: false, error: 'This claim link is no longer valid' };
    }

    if (invite.status !== 'sent' && invite.status !== 'pending') {
      return { success: false, error: 'This claim link is not ready to use' };
    }

    const expiresAt = new Date(invite.expires_at as string);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      await (adminClient as any)
        .from('certificate_claim_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      return { success: false, error: 'This claim link has expired' };
    }

    const inviteeEmail = normalizeInviteEmail(invite.invitee_email as string);
    if (!emailsMatch(userEmail, inviteeEmail)) {
      console.error('[Certificates] consumeCertificateClaim email mismatch', {
        userId: user.id,
      });
      return {
        success: false,
        error: `Sign in with the email this invite was sent to (${inviteeEmail}).`,
      };
    }

    const { data: sourceArtwork, error: sourceError } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('id', invite.source_artwork_id as string)
      .single();

    if (sourceError || !sourceArtwork) {
      logger.error('consume_claim_source_fetch_failed', { error: sourceError });
      return { success: false, error: 'Could not load source certificate' };
    }

    const kind = invite.claim_kind as string;

    if (kind === 'owner_coownership_from_coa') {
      if (sourceArtwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
        return { success: false, error: 'Invalid source certificate for this claim' };
      }

      const { id: newId } = await insertLinkedCertificateOfOwnershipFromCoa(adminClient, sourceArtwork, {
        ownerAccountId: user.id,
        createdByUserId: user.id,
      });

      await (adminClient as any)
        .from('certificate_claim_invites')
        .update({
          status: 'consumed',
          consumed_at: new Date().toISOString(),
          consumed_by: user.id,
          result_artwork_id: newId,
        })
        .eq('id', invite.id);

      try {
        await createNotification({
          userId: sourceArtwork.account_id as string,
          type: 'certificate_claimed',
          title: `Certificate of Ownership claimed: ${sourceArtwork.title}`,
          message: `A collector has claimed their Certificate of Ownership for "${sourceArtwork.title}".`,
          artworkId: newId,
          relatedUserId: user.id,
        });
      } catch (e) {
        logger.error('consume_coo_owner_notify_failed', { error: e });
      }

      revalidatePath('/portal');
      revalidatePath(`/artworks/${newId}/certificate`);
      return { success: true, artworkId: newId };
    }

    if (kind === 'artist_coa_from_show' || kind === 'artist_coa_from_coo') {
      const expectedType =
        kind === 'artist_coa_from_show' ? CERTIFICATE_TYPES.SHOW : CERTIFICATE_TYPES.OWNERSHIP;
      if (sourceArtwork.certificate_type !== expectedType) {
        return { success: false, error: 'Invalid source certificate for this claim' };
      }

      const requestId = invite.provenance_update_request_id as string | null;
      if (!requestId) {
        return { success: false, error: 'Claim request is missing; contact support' };
      }

      const { data: provRequest, error: reqErr } = await (adminClient as any)
        .from('provenance_update_requests')
        .select('id, requested_by, status, request_type')
        .eq('id', requestId)
        .single();

      if (reqErr || !provRequest || provRequest.request_type !== 'artist_claim') {
        return { success: false, error: 'Claim request not found' };
      }

      if (provRequest.status !== 'approved') {
        return { success: false, error: 'This claim has not been approved yet' };
      }

      if (provRequest.requested_by !== user.id) {
        return { success: false, error: 'You must sign in as the artist who submitted this claim' };
      }

      const { id: newId } = await insertArtistCoaFromSourceCertificate(adminClient, sourceArtwork, {
        artistAccountId: user.id,
        createdByUserId: user.id,
      });

      await (adminClient as any)
        .from('certificate_claim_invites')
        .update({
          status: 'consumed',
          consumed_at: new Date().toISOString(),
          consumed_by: user.id,
          result_artwork_id: newId,
        })
        .eq('id', invite.id);

      try {
        await createNotification({
          userId: user.id,
          type: 'certificate_verified',
          title: `Certificate of Authenticity ready: ${sourceArtwork.title}`,
          message: `Your Certificate of Authenticity for "${sourceArtwork.title}" is linked to this work.`,
          artworkId: newId,
          relatedUserId: sourceArtwork.account_id as string,
          metadata: { source_artwork_id: sourceArtwork.id },
        });
      } catch (e) {
        logger.error('consume_artist_coa_notify_failed', { error: e });
      }

      const { data: otherCerts } = await (adminClient as any)
        .from('artworks')
        .select('id, title')
        .eq('account_id', sourceArtwork.account_id as string)
        .eq('artist_name', sourceArtwork.artist_name)
        .in('certificate_type', [CERTIFICATE_TYPES.SHOW, CERTIFICATE_TYPES.OWNERSHIP])
        .neq('id', sourceArtwork.id);

      if (otherCerts && otherCerts.length > 0) {
        try {
          await createNotification({
            userId: sourceArtwork.account_id as string,
            type: 'artist_claim_other_certificates',
            title: `Add more certificates for ${sourceArtwork.artist_name}`,
            message: `An artist completed their claim for "${sourceArtwork.title}". You have ${otherCerts.length} other certificate(s) for this artist that you can add to their profile from your portal.`,
            artworkId: sourceArtwork.id,
            relatedUserId: user.id,
            metadata: { other_artwork_ids: otherCerts.map((a: { id: string }) => a.id) },
          });
        } catch (e) {
          logger.error('consume_artist_coa_owner_other_notify_failed', { error: e });
        }
      }

      revalidatePath('/portal');
      revalidatePath(`/artworks/${newId}/certificate`);
      return { success: true, artworkId: newId };
    }

    return { success: false, error: 'Unsupported claim type' };
  } catch (err) {
    console.error('[Certificates] consumeCertificateClaim failed', err);
    logger.error('consume_certificate_claim_failed', { error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Claim failed' };
  }
}
