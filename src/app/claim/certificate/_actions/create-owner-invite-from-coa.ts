'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { logger } from '~/lib/logger';
import { ensureSaleForSentOwnershipInvite } from '~/lib/sales/record-sale';
import { canSellArtwork } from '~/lib/sales/can-sell-artwork';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { generateClaimToken, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { sendOwnerCoownershipInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { notifyInviteEmailFailed } from '~/lib/certificate-claims/notify-invite-email-failed';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_DAY = 20;

export type CreateOwnerInviteResult =
  | { success: true }
  | { success: false; error: string; emailFailed?: boolean };

/**
 * Issue a Certificate of Ownership from a Certificate of Authenticity or a
 * show's Certificate of Show: emails the collector a claim link and records
 * the sale. Allowed for the holder, their gallery / institution team, and
 * managers of a show that hung the work.
 */
export async function createOwnerInviteFromCoa(
  artworkId: string,
  inviteeEmailRaw: string,
  inviteeName?: string,
  priceCents?: number | null,
): Promise<CreateOwnerInviteResult> {
  console.log('[Certificates] createOwnerInviteFromCoa started', { artworkId });
  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in' };
    }

    const inviteeEmail = normalizeInviteEmail(inviteeEmailRaw);
    if (!inviteeEmail || !inviteeEmail.includes('@')) {
      return { success: false, error: 'Enter a valid email address' };
    }

    const adminClient = getSupabaseServerAdminClient();
    // Admin read: RLS hides gallery-held certificates from team members.
    const { data: artwork, error: artError } = await asUntyped(adminClient)
      .from('artworks')
      .select('id, account_id, gallery_profile_id, title, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      return { success: false, error: 'Certificate not found' };
    }

    if (!(await canSellArtwork(user.id, artwork as { id: string; account_id: string | null; gallery_profile_id: string | null }))) {
      return { success: false, error: 'Only the certificate holder or their team can issue a Certificate of Ownership' };
    }

    const certType = (artwork.certificate_type as string | null) || CERTIFICATE_TYPES.AUTHENTICITY;
    if (certType !== CERTIFICATE_TYPES.AUTHENTICITY && certType !== CERTIFICATE_TYPES.SHOW) {
      return {
        success: false,
        error: 'Issue a Certificate of Ownership from the Certificate of Authenticity or the show’s Certificate of Show',
      };
    }
    const claimKind =
      certType === CERTIFICATE_TYPES.SHOW ? 'owner_coownership_from_cos' : 'owner_coownership_from_coa';

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { count, error: countError } = await asUntyped(adminClient)
        .from('certificate_claim_invites')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .gte('created_at', since);

      if (!countError && count != null && count >= MAX_INVITES_PER_DAY) {
        return { success: false, error: 'Too many invites sent recently. Try again tomorrow.' };
      }
    } catch (rateErr) {
      console.error('[Certificates] createOwnerInviteFromCoa rate limit check failed', rateErr);
    }

    const { data: existingOpen } = await asUntyped(adminClient)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', inviteeEmail)
      .eq('claim_kind', claimKind)
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      return { success: false, error: 'An open invite already exists for this email' };
    }

    const token = generateClaimToken();
    const tokenHash = hashClaimToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error: insertError } = await asUntyped(adminClient).from('certificate_claim_invites').insert({
      source_artwork_id: artworkId,
      claim_kind: claimKind,
      invitee_email: inviteeEmail,
      token_hash: tokenHash,
      status: 'sent',
      expires_at: expiresAt,
      created_by: user.id,
    });

    if (insertError) {
      console.error('[Certificates] createOwnerInviteFromCoa insert failed', insertError);
      logger.error('create_owner_invite_insert_failed', { artworkId, error: insertError });
      return { success: false, error: 'Could not create invite' };
    }

    await client.from('accounts').select('name').eq('id', user.id).single();
    const artworkTitle = (artwork.title as string) || 'Your artwork';

    try {
      await sendOwnerCoownershipInviteEmail({
        to: inviteeEmail,
        recipientName: inviteeEmail.split('@')[0] || 'there',
        artworkTitle,
        token,
      });
    } catch (emailErr) {
      console.error('[Certificates] createOwnerInviteFromCoa email failed', emailErr);
      logger.error('create_owner_invite_email_failed', { artworkId, error: emailErr });
      const reason = emailErr instanceof Error ? emailErr.message : 'unknown error';
      // Nobody received the link — cancel so the open-invite check doesn't block a retry.
      await asUntyped(adminClient)
        .from('certificate_claim_invites')
        .update({ status: 'cancelled' })
        .eq('token_hash', tokenHash);
      await notifyInviteEmailFailed({
        senderUserId: user.id,
        inviteeEmail,
        artworkTitles: [artworkTitle],
        artworkId,
        reason,
      });
      return {
        success: false,
        emailFailed: true,
        error: `Email to ${inviteeEmail} was not delivered: ${reason}`,
      };
    }

    console.log('[Certificates] createOwnerInviteFromCoa success', { artworkId });
    // Sending the CoO records the sale to this collector, so they appear on
    // collector lists and in sales analytics before they accept.
    try {
      await ensureSaleForSentOwnershipInvite(adminClient, {
        sourceArtworkId: artworkId,
        buyerEmail: inviteeEmail,
        buyerName: inviteeName || null,
        recordedBy: user.id,
        priceCents: priceCents ?? null,
      });
    } catch (saleErr) {
      logger.error('create_owner_invite_ensure_sale_failed', { artworkId, error: saleErr });
    }
    await captureCrmContacts(user.id, [
      {
        email: inviteeEmail,
        name: inviteeName || null,
        source: 'certificate',
        artworkId,
        notes: `Certificate of ownership invite — ${artworkTitle}`,
      },
    ]);
    return { success: true };
  } catch (err) {
    console.error('[Certificates] createOwnerInviteFromCoa failed', err);
    logger.error('create_owner_invite_failed', { artworkId, error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send invite' };
  }
}
