'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import {
  generateClaimToken,
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import { sendExhibitionArtistInviteEmail } from '~/lib/certificate-claims/send-certificate-invite-email';
import { INVITE_TTL_MS } from '~/lib/certificate-claims/create-invite-batch';

export type ExhibitionArtistInviteInput = {
  email: string;
  name?: string | null;
  artistAccountId?: string | null;
};

export type ExhibitionArtistInviteRow = {
  id: string;
  exhibition_id: string;
  invitee_email: string;
  invitee_name: string | null;
  artist_account_id: string | null;
  status: string;
  expires_at: string;
  consumed_at: string | null;
  result_artwork_id: string | null;
  result_cos_artwork_id: string | null;
  created_at: string;
};

const OPEN_STATUSES = ['pending', 'sent'];

async function assertCanManageExhibition(
  userId: string,
  exhibitionId: string,
): Promise<{ galleryId: string; title: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: exhibition, error } = await asUntyped(client)
    .from('exhibitions')
    .select('id, gallery_id, title')
    .eq('id', exhibitionId)
    .single();

  if (error || !exhibition) {
    throw new Error('Exhibition not found');
  }

  const canManage = await canManageExhibition(userId, exhibition.gallery_id);
  if (!canManage) {
    throw new Error('Access denied');
  }

  return { galleryId: exhibition.gallery_id, title: exhibition.title };
}

async function getSenderName(userId: string): Promise<string | undefined> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: account } = await client
    .from('accounts')
    .select('name')
    .eq('id', userId)
    .maybeSingle();
  return account?.name ?? undefined;
}

export async function createExhibitionArtistInvites(
  exhibitionId: string,
  invites: ExhibitionArtistInviteInput[],
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  console.log('[Exhibitions] createExhibitionArtistInvites started', {
    exhibitionId,
    count: invites.length,
  });

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { title: exhibitionTitle } = await assertCanManageExhibition(
    user.id,
    exhibitionId,
  );

  const adminClient = getSupabaseServerAdminClient();
  const senderName = await getSenderName(user.id);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  const crmContacts: Array<{
    email?: string | null;
    name?: string | null;
    source: string;
    notes?: string | null;
  }> = [];

  for (const raw of invites) {
    const email = normalizeInviteEmail(raw.email);
    if (!email || !email.includes('@')) {
      errors.push(`Invalid email: ${raw.email}`);
      continue;
    }

    const name = raw.name?.trim() || null;

    try {
      const { data: existing } = await asUntyped(adminClient)
        .from('exhibition_artist_invites')
        .select('id')
        .eq('exhibition_id', exhibitionId)
        .ilike('invitee_email', email)
        .in('status', OPEN_STATUSES)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const token = generateClaimToken();
      const tokenHash = hashClaimToken(token);
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

      const { error: insertError } = await asUntyped(adminClient)
        .from('exhibition_artist_invites')
        .insert({
          exhibition_id: exhibitionId,
          invitee_email: email,
          invitee_name: name,
          artist_account_id: raw.artistAccountId ?? null,
          token_hash: tokenHash,
          status: 'sent',
          expires_at: expiresAt,
          created_by: user.id,
        });

      if (insertError) {
        console.error('[Exhibitions] createExhibitionArtistInvites insert failed', insertError);
        errors.push(`Could not invite ${email}`);
        continue;
      }

      try {
        await sendExhibitionArtistInviteEmail({
          to: email,
          recipientName: name || email.split('@')[0] || 'there',
          exhibitionTitle,
          senderName,
          token,
        });
      } catch (emailErr) {
        console.error('[Exhibitions] createExhibitionArtistInvites email failed', emailErr);
        errors.push(`Invite saved for ${email} but email delivery failed`);
      }

      crmContacts.push({
        email,
        name,
        source: 'exhibition',
        notes: `Exhibition invite — ${exhibitionTitle}`,
      });

      sent++;
    } catch (err) {
      console.error('[Exhibitions] createExhibitionArtistInvites error', { email, err });
      errors.push(`Failed to invite ${email}`);
    }
  }

  if (crmContacts.length > 0) {
    await captureCrmContacts(user.id, crmContacts);
  }

  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  console.log('[Exhibitions] createExhibitionArtistInvites completed', {
    sent,
    skipped,
    errorCount: errors.length,
  });

  return { sent, skipped, errors };
}

export async function getExhibitionInvites(
  exhibitionId: string,
): Promise<ExhibitionArtistInviteRow[]> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  await assertCanManageExhibition(user.id, exhibitionId);

  const adminClient = getSupabaseServerAdminClient();
  const { data, error } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select(
      'id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, expires_at, consumed_at, result_artwork_id, result_cos_artwork_id, created_at',
    )
    .eq('exhibition_id', exhibitionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Exhibitions] getExhibitionInvites failed', error);
    throw new Error('Could not load invites');
  }

  return (data ?? []) as ExhibitionArtistInviteRow[];
}

export async function resendExhibitionInvite(
  inviteId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[Exhibitions] resendExhibitionInvite started', { inviteId });

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const { data: invite, error: fetchError } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select('id, exhibition_id, invitee_email, invitee_name, status')
    .eq('id', inviteId)
    .single();

  if (fetchError || !invite) {
    return { success: false, error: 'Invite not found' };
  }

  if (invite.status === 'consumed' || invite.status === 'cancelled') {
    return { success: false, error: 'This invite can no longer be resent' };
  }

  try {
    const { title: exhibitionTitle } = await assertCanManageExhibition(
      user.id,
      invite.exhibition_id,
    );

    const token = generateClaimToken();
    const tokenHash = hashClaimToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const senderName = await getSenderName(user.id);

    const { error: updateError } = await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({
        token_hash: tokenHash,
        status: 'sent',
        expires_at: expiresAt,
      })
      .eq('id', inviteId);

    if (updateError) {
      console.error('[Exhibitions] resendExhibitionInvite update failed', updateError);
      return { success: false, error: 'Could not refresh invite' };
    }

    await sendExhibitionArtistInviteEmail({
      to: invite.invitee_email,
      recipientName:
        invite.invitee_name || invite.invitee_email.split('@')[0] || 'there',
      exhibitionTitle,
      senderName,
      token,
    });

    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    console.log('[Exhibitions] resendExhibitionInvite succeeded', { inviteId });
    return { success: true };
  } catch (err) {
    console.error('[Exhibitions] resendExhibitionInvite failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Resend failed',
    };
  }
}

export async function cancelExhibitionInvite(
  inviteId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[Exhibitions] cancelExhibitionInvite started', { inviteId });

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const { data: invite, error: fetchError } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select('id, exhibition_id, status')
    .eq('id', inviteId)
    .single();

  if (fetchError || !invite) {
    return { success: false, error: 'Invite not found' };
  }

  if (invite.status === 'consumed') {
    return { success: false, error: 'Submitted invites cannot be cancelled' };
  }

  try {
    await assertCanManageExhibition(user.id, invite.exhibition_id);

    const { error: updateError } = await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId);

    if (updateError) {
      console.error('[Exhibitions] cancelExhibitionInvite update failed', updateError);
      return { success: false, error: 'Could not cancel invite' };
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    console.log('[Exhibitions] cancelExhibitionInvite succeeded', { inviteId });
    return { success: true };
  } catch (err) {
    console.error('[Exhibitions] cancelExhibitionInvite failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Cancel failed',
    };
  }
}

export async function getExhibitionInviteContext(token: string): Promise<
  | {
      valid: true;
      exhibitionTitle: string;
      galleryName: string | null;
      inviteeEmail: string;
      inviteeName: string | null;
      status: string;
    }
  | { valid: false; error: string }
> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return { valid: false, error: 'Missing invite token' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const tokenHash = hashClaimToken(trimmed);

  const { data: invite, error } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select(
      'id, invitee_email, invitee_name, status, expires_at, exhibition_id',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return { valid: false, error: 'Invalid or expired invite link' };
  }

  if (invite.status === 'cancelled') {
    return { valid: false, error: 'This invitation has been cancelled' };
  }

  if (invite.status === 'consumed') {
    return { valid: false, error: 'This invitation has already been used' };
  }

  const expiresAt = new Date(invite.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return { valid: false, error: 'This invitation has expired' };
  }

  const { data: exhibition } = await asUntyped(adminClient)
    .from('exhibitions')
    .select('title, gallery_id')
    .eq('id', invite.exhibition_id)
    .single();

  let galleryName: string | null = null;
  if (exhibition?.gallery_id) {
    const { data: galleryAccount } = await asUntyped(adminClient)
      .from('accounts')
      .select('name')
      .eq('id', exhibition.gallery_id)
      .maybeSingle();
    galleryName = galleryAccount?.name ?? null;
  }

  return {
    valid: true,
    exhibitionTitle: exhibition?.title ?? 'Exhibition',
    galleryName,
    inviteeEmail: invite.invitee_email,
    inviteeName: invite.invitee_name,
    status: invite.status,
  };
}
