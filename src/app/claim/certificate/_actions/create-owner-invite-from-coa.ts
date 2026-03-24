'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { generateClaimToken, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { sendOwnerCoownershipInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_DAY = 20;

export type CreateOwnerInviteResult =
  | { success: true }
  | { success: false; error: string };

export async function createOwnerInviteFromCoa(
  artworkId: string,
  inviteeEmailRaw: string,
): Promise<CreateOwnerInviteResult> {
  console.log('[Certificates] createOwnerInviteFromCoa started', { artworkId });
  try {
    const client = getSupabaseServerClient();
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

    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      return { success: false, error: 'Certificate not found' };
    }

    if (artwork.account_id !== user.id) {
      return { success: false, error: 'Only the certificate owner can invite an owner' };
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
      return { success: false, error: 'Only a Certificate of Authenticity can invite a linked Certificate of Ownership' };
    }

    const adminClient = getSupabaseServerAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { count, error: countError } = await (adminClient as any)
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

    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', inviteeEmail)
      .eq('claim_kind', 'owner_coownership_from_coa')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      return { success: false, error: 'An open invite already exists for this email' };
    }

    const token = generateClaimToken();
    const tokenHash = hashClaimToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error: insertError } = await (adminClient as any).from('certificate_claim_invites').insert({
      source_artwork_id: artworkId,
      claim_kind: 'owner_coownership_from_coa',
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

    const { data: account } = await client.from('accounts').select('name').eq('id', user.id).single();
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
    }

    console.log('[Certificates] createOwnerInviteFromCoa success', { artworkId });
    return { success: true };
  } catch (err) {
    console.error('[Certificates] createOwnerInviteFromCoa failed', err);
    logger.error('create_owner_invite_failed', { artworkId, error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send invite' };
  }
}
