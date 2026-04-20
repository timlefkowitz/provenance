'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { logger } from '~/lib/logger';
import { generateClaimToken, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { sendGalleryCoSInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type BatchSendGalleryCoSInvitesResult =
  | { success: true; sent: number }
  | { success: false; error: string };

/**
 * Invites a gallery or institution to create Certificates of Show for the
 * selected artworks. One invite token is issued per artwork so the recipient
 * can claim each one independently.
 *
 * claim_kind: 'gallery_cos_from_artist'
 * Provenance chain: Gallery CoS.source_artwork_id → Artist's CoA
 */
export async function batchSendGalleryCoSInvites(
  artworkIds: string[],
  inviteEmail: string,
  recipientRole: 'gallery' | 'institution',
): Promise<BatchSendGalleryCoSInvitesResult> {
  console.log('[Collection] batchSendGalleryCoSInvites started', {
    count: artworkIds.length,
    recipientRole,
  });

  if (artworkIds.length === 0) {
    return { success: false, error: 'No artworks selected' };
  }

  const normalizedEmail = normalizeInviteEmail(inviteEmail);
  if (!normalizedEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const adminClient = getSupabaseServerAdminClient();

  // Verify all artworks belong to the current user and are CoA type
  const { data: artworks, error: artworksError } = await (adminClient as any)
    .from('artworks')
    .select('id, title, artist_name, certificate_type, account_id')
    .in('id', artworkIds);

  if (artworksError || !artworks?.length) {
    console.error('[Collection] batchSendGalleryCoSInvites artworks fetch failed', artworksError);
    return { success: false, error: 'Could not load selected artworks' };
  }

  const unauthorized = (artworks as Array<{ account_id: string }>).find(
    (a) => a.account_id !== user.id,
  );
  if (unauthorized) {
    return { success: false, error: 'You can only send invites for artworks you own' };
  }

  // Insert one invite row per artwork
  let sent = 0;
  const errors: string[] = [];
  const titlesSent: string[] = [];

  for (const artwork of artworks as Array<{
    id: string;
    title: string | null;
    artist_name: string | null;
    certificate_type: string | null;
    account_id: string;
  }>) {
    const token = generateClaimToken();
    const tokenHash = hashClaimToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error: insertError } = await (adminClient as any)
      .from('certificate_claim_invites')
      .insert({
        source_artwork_id: artwork.id,
        claim_kind: 'gallery_cos_from_artist',
        invitee_email: normalizedEmail,
        token_hash: tokenHash,
        status: 'sent',
        expires_at: expiresAt,
        created_by: user.id,
        provenance_update_request_id: null,
      });

    if (insertError) {
      console.error('[Collection] batchSendGalleryCoSInvites insert failed', {
        artworkId: artwork.id,
        insertError,
      });
      logger.error('batch_gallery_cos_invite_insert_failed', {
        artworkId: artwork.id,
        error: insertError,
      });
      errors.push(`Could not create invite for "${artwork.title ?? artwork.id}"`);
      continue;
    }

    try {
      await sendGalleryCoSInviteEmail({
        to: normalizedEmail,
        recipientName: normalizedEmail.split('@')[0] || 'there',
        artworkTitle: artwork.title ?? 'this artwork',
        artistName: artwork.artist_name ?? undefined,
        recipientRole,
        token,
      });
    } catch (emailError) {
      console.error('[Collection] batchSendGalleryCoSInvites email failed', {
        artworkId: artwork.id,
        emailError,
      });
      logger.error('batch_gallery_cos_invite_email_failed', {
        artworkId: artwork.id,
        error: emailError,
      });
    }

    sent++;
    titlesSent.push(artwork.title ?? artwork.id);
  }

  console.log('[Collection] batchSendGalleryCoSInvites finished', {
    sent,
    errorCount: errors.length,
  });

  if (sent === 0) {
    return { success: false, error: errors[0] ?? 'Failed to send any invites' };
  }

  return { success: true, sent };
}
