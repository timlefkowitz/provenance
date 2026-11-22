'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import {
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import {
  formatExhibitionDateRange,
  sendExhibitionArtistInviteEmail,
  type ExhibitionInviteDetails,
} from '~/lib/certificate-claims/send-certificate-invite-email';
import { createNotification } from '~/lib/notifications';
import { INVITE_TTL_MS } from '~/lib/certificate-claims/create-invite-batch';
import { ownerReceivesCertificateOfShow } from '../_helpers/exhibition-owner-roles';
import { parseMaxArtworksPerArtist } from '../_helpers/exhibition-invite-limits';
import {
  invitedWorkGoesStraightIn,
  OPEN_INVITE_STATUSES,
  parseShowType,
  type ShowType,
} from '../_helpers/show-collaboration';
import { findInviteByKey } from '~/lib/exhibitions/invite-key';
import { deriveInviteToken, newInviteTokenNonce } from '~/lib/exhibitions/invite-link-token';
import { getExhibitionSubmitUrl } from '~/lib/certificate-claims/site-url';
import { randomUUID } from 'crypto';

export type ExhibitionArtistInviteInput = {
  email: string;
  name?: string | null;
  artistAccountId?: string | null;
  /** Upload limit for this artist; omitted falls back to the exhibition default. */
  maxArtworks?: number | null;
};

export type ExhibitionArtistInviteRow = {
  id: string;
  exhibition_id: string;
  /** Null for a link-only invite no artist has opened yet. */
  invitee_email: string | null;
  invitee_name: string | null;
  artist_account_id: string | null;
  status: string;
  max_artworks: number | null;
  submitted_count: number;
  source: string;
  expires_at: string;
  consumed_at: string | null;
  result_artwork_id: string | null;
  result_cos_artwork_id: string | null;
  created_at: string;
  accepted_at: string | null;
  planned_piece_count: number | null;
  artist_notes: string | null;
  can_edit_show: boolean;
};

const OPEN_STATUSES: string[] = [...OPEN_INVITE_STATUSES];

/**
 * A fresh invite id, nonce and token. The token is derived (see
 * invite-link-token) so the organiser can copy the same link again later.
 */
function newInviteCredentials(inviteId: string = randomUUID()): {
  id: string;
  nonce: string;
  token: string;
  tokenHash: string;
} {
  const nonce = newInviteTokenNonce();
  const token = deriveInviteToken(inviteId, nonce);
  return { id: inviteId, nonce, token, tokenHash: hashClaimToken(token) };
}

async function assertCanManageExhibition(
  userId: string,
  exhibitionId: string,
): Promise<{
  galleryId: string;
  title: string;
  details: ExhibitionInviteDetails;
  defaultMaxArtworks: number | null;
  showType: ShowType | null;
}> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: exhibition, error } = await asUntyped(client)
    .from('exhibitions')
    .select('id, gallery_id, title, description, location, start_date, end_date, owner_role, metadata, show_type')
    .eq('id', exhibitionId)
    .single();

  if (error || !exhibition) {
    throw new Error('Exhibition not found');
  }

  const canManage = await canManageExhibition(userId, exhibition.gallery_id);
  if (!canManage) {
    throw new Error('Access denied');
  }

  return {
    galleryId: exhibition.gallery_id,
    title: exhibition.title,
    details: {
      title: exhibition.title,
      description: exhibition.description ?? null,
      location: exhibition.location ?? null,
      startDate: exhibition.start_date,
      endDate: exhibition.end_date ?? null,
      confirmedArtists: await getConfirmedArtistNames(exhibitionId),
      issuesCertificateOfShow: ownerReceivesCertificateOfShow(exhibition.owner_role),
      showType: parseShowType(exhibition.show_type),
    },
    defaultMaxArtworks: parseMaxArtworksPerArtist(
      (exhibition.metadata as Record<string, unknown> | null)?.max_artworks_per_artist,
    ),
    showType: parseShowType(exhibition.show_type),
  };
}

/** Names of artists already credited on the exhibition, for the invite email. */
async function getConfirmedArtistNames(exhibitionId: string): Promise<string[]> {
  const adminClient = getSupabaseServerAdminClient();
  const { data: rows, error } = await asUntyped(adminClient)
    .from('exhibition_artists')
    .select('artist_account_id')
    .eq('exhibition_id', exhibitionId);

  if (error) {
    console.error('[Exhibitions] getConfirmedArtistNames failed', error);
    return [];
  }

  const ids = (rows ?? []).map((r: { artist_account_id: string }) => r.artist_account_id);
  if (ids.length === 0) return [];

  const { data: accounts } = await asUntyped(adminClient)
    .from('accounts')
    .select('name')
    .in('id', ids);

  return (accounts ?? [])
    .map((a: { name: string | null }) => a.name?.trim())
    .filter((name: string | undefined): name is string => !!name);
}

/**
 * In-app (and push) notification for an invitee who already has an account.
 * Invitees without an account get the email only.
 */
async function notifyInvitedArtist(params: {
  email: string;
  artistAccountId: string | null;
  senderId: string;
  senderName: string | undefined;
  exhibitionId: string;
  details: ExhibitionInviteDetails;
  token: string;
  maxArtworks: number | null;
}): Promise<void> {
  const { email, senderId, senderName, exhibitionId, details, token, maxArtworks } = params;
  let recipientId = params.artistAccountId;

  if (!recipientId) {
    const adminClient = getSupabaseServerAdminClient();
    const { data: account } = await asUntyped(adminClient)
      .from('accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    recipientId = account?.id ?? null;
  }

  if (!recipientId || recipientId === senderId) return;

  const when = formatExhibitionDateRange(details.startDate, details.endDate);
  const where = details.location?.trim() ? ` at ${details.location.trim()}` : '';
  const upload =
    details.showType === 'solo'
      ? 'Fill in the show details, how many pieces you plan to show, and add your work.'
      : maxArtworks
        ? `Upload up to ${maxArtworks} ${maxArtworks === 1 ? 'artwork' : 'artworks'}${details.showType === 'group' ? '' : ' for consideration'}.`
        : "Upload the work you'll be showing.";
  const title =
    details.showType === 'solo'
      ? `You're invited to a solo show: "${details.title}"`
      : `You're invited to show in "${details.title}"`;

  try {
    await createNotification({
      userId: recipientId,
      type: 'exhibition_invite',
      title,
      message: `${senderName ?? 'An organiser'} invited you to exhibit${where}, ${when}. ${upload}`,
      relatedUserId: senderId,
      metadata: {
        exhibition_id: exhibitionId,
        submit_path: `/exhibitions/submit?${new URLSearchParams({ token }).toString()}`,
      },
    });
  } catch (err) {
    console.error('[Exhibitions] notifyInvitedArtist failed', { exhibitionId, err });
  }
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

  const { title: exhibitionTitle, details, defaultMaxArtworks, showType } = await assertCanManageExhibition(
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
    const maxArtworks =
      raw.maxArtworks === undefined ? defaultMaxArtworks : parseMaxArtworksPerArtist(raw.maxArtworks);

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

      const creds = newInviteCredentials();
      const token = creds.token;
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

      const { error: insertError } = await asUntyped(adminClient)
        .from('exhibition_artist_invites')
        .insert({
          id: creds.id,
          token_nonce: creds.nonce,
          exhibition_id: exhibitionId,
          invitee_email: email,
          invitee_name: name,
          artist_account_id: raw.artistAccountId ?? null,
          max_artworks: maxArtworks,
          token_hash: creds.tokenHash,
          status: 'sent',
          expires_at: expiresAt,
          created_by: user.id,
          can_edit_show: showType === 'solo',
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
          exhibition: details,
          senderName,
          token,
          maxArtworks,
        });
      } catch (emailErr) {
        console.error('[Exhibitions] createExhibitionArtistInvites email failed', emailErr);
        errors.push(`Invite saved for ${email} but email delivery failed`);
      }

      await notifyInvitedArtist({
        email,
        artistAccountId: raw.artistAccountId ?? null,
        senderId: user.id,
        senderName,
        exhibitionId,
        details,
        token,
        maxArtworks,
      });

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
      'id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, max_artworks, submitted_count, source, expires_at, consumed_at, result_artwork_id, result_cos_artwork_id, created_at, accepted_at, planned_piece_count, artist_notes, can_edit_show',
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
    .select('id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, max_artworks')
    .eq('id', inviteId)
    .single();

  if (fetchError || !invite) {
    return { success: false, error: 'Invite not found' };
  }

  if (invite.status === 'consumed' || invite.status === 'cancelled') {
    return { success: false, error: 'This invite can no longer be resent' };
  }
  if (!invite.invitee_email) {
    return { success: false, error: 'This is a link invite; copy the link and send it to the artist' };
  }

  try {
    const { details } = await assertCanManageExhibition(user.id, invite.exhibition_id);

    const { nonce, token, tokenHash } = newInviteCredentials(invite.id);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const senderName = await getSenderName(user.id);

    const { error: updateError } = await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({
        token_hash: tokenHash,
        token_nonce: nonce,
        // An accepted invite stays accepted; the fresh link just gets them back in.
        status: invite.status === 'accepted' ? 'accepted' : 'sent',
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
      exhibition: details,
      senderName,
      token,
      maxArtworks: invite.max_artworks ?? null,
    });

    await notifyInvitedArtist({
      email: normalizeInviteEmail(invite.invitee_email),
      artistAccountId: invite.artist_account_id ?? null,
      senderId: user.id,
      senderName,
      exhibitionId: invite.exhibition_id,
      details,
      token,
      maxArtworks: invite.max_artworks ?? null,
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

export type ExhibitionInviteContext = {
  valid: true;
  inviteId: string;
  exhibitionId: string;
  exhibitionTitle: string;
  galleryName: string | null;
  issuesCertificateOfShow: boolean;
  /** Null for a link-only invite: any artist who signs in can claim it. */
  inviteeEmail: string | null;
  inviteeName: string | null;
  status: string;
  maxArtworks: number | null;
  /** Open call page where the artist can follow their submission's review. */
  statusPath: string | null;
  showType: ShowType | null;
  /** Invited solo/group artist: work goes straight in, invite stays open. */
  straightIn: boolean;
  /** The artist's own page for this show (solo/group invites). */
  workspacePath: string | null;
};

/**
 * Context for the submit page. `key` is the emailed token or `invite:<id>`
 * (see ~/lib/exhibitions/invite-key).
 */
export async function getExhibitionInviteContext(
  key: string,
): Promise<ExhibitionInviteContext | { valid: false; error: string }> {
  if (!key?.trim()) {
    return { valid: false, error: 'Missing invite token' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const { invite, byId, error } = await findInviteByKey<{
    id: string;
    invitee_email: string | null;
    invitee_name: string | null;
    status: string;
    max_artworks: number | null;
    expires_at: string;
    exhibition_id: string;
    source: string;
    accepted_by: string | null;
  }>(
    asUntyped(adminClient),
    key,
    'id, invitee_email, invitee_name, status, max_artworks, expires_at, exhibition_id, source, accepted_by',
  );

  if (error || !invite) {
    return { valid: false, error: 'Invalid or expired invite link' };
  }

  // Invite-id links only work for the artist who accepted the invite.
  if (byId) {
    const {
      data: { user },
    } = await getSupabaseServerClient().auth.getUser();
    if (!user || user.id !== invite.accepted_by) {
      return { valid: false, error: 'Sign in with the account that accepted this invitation' };
    }
  }

  if (invite.status === 'cancelled') {
    return { valid: false, error: 'This invitation has been cancelled' };
  }

  if (invite.status === 'consumed') {
    return { valid: false, error: 'This invitation has already been used' };
  }

  const expiresAt = new Date(invite.expires_at);
  if (
    invite.status !== 'accepted' &&
    (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date())
  ) {
    await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return { valid: false, error: 'This invitation has expired' };
  }

  const { data: exhibition } = await asUntyped(adminClient)
    .from('exhibitions')
    .select('title, gallery_id, owner_role, show_type')
    .eq('id', invite.exhibition_id)
    .single();

  const { data: openCall } = await asUntyped(adminClient)
    .from('open_calls')
    .select('slug')
    .eq('exhibition_id', invite.exhibition_id)
    .eq('submission_mode', 'exhibition')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let galleryName: string | null = null;
  if (exhibition?.gallery_id) {
    const { data: galleryAccount } = await asUntyped(adminClient)
      .from('accounts')
      .select('name')
      .eq('id', exhibition.gallery_id)
      .maybeSingle();
    galleryName = galleryAccount?.name ?? null;
  }

  const showType = parseShowType(exhibition?.show_type);
  const straightIn = invitedWorkGoesStraightIn(showType, invite.source);

  return {
    valid: true,
    inviteId: invite.id,
    exhibitionId: invite.exhibition_id,
    exhibitionTitle: exhibition?.title ?? 'Exhibition',
    galleryName,
    issuesCertificateOfShow: ownerReceivesCertificateOfShow(exhibition?.owner_role),
    inviteeEmail: invite.invitee_email,
    inviteeName: invite.invitee_name,
    status: invite.status,
    maxArtworks: invite.max_artworks ?? null,
    statusPath: openCall?.slug ? `/open-calls/${openCall.slug}` : null,
    showType,
    straightIn,
    workspacePath: straightIn ? `/exhibitions/${invite.exhibition_id}/artist` : null,
  };
}

export type CreditedArtistInviteStatus = {
  artistAccountId: string;
  name: string;
  hasEmail: boolean;
};

/**
 * Credited artists (exhibition_artists) who have never been sent an upload
 * invite — open or submitted — for this exhibition. Emails stay server-side.
 */
async function findUninvitedCreditedArtists(
  exhibitionId: string,
  organiserId: string,
  onlyArtistIds?: string[],
): Promise<Array<CreditedArtistInviteStatus & { email: string | null }>> {
  const adminClient = getSupabaseServerAdminClient();

  let ids = onlyArtistIds;
  if (!ids) {
    const { data: rows, error } = await asUntyped(adminClient)
      .from('exhibition_artists')
      .select('artist_account_id')
      .eq('exhibition_id', exhibitionId);
    if (error) {
      console.error('[Exhibitions] findUninvitedCreditedArtists artists failed', error);
      return [];
    }
    ids = (rows ?? []).map((r: { artist_account_id: string }) => r.artist_account_id);
  }
  ids = [...new Set(ids)].filter((id) => id !== organiserId);
  if (ids.length === 0) return [];

  const [{ data: accounts }, { data: invites }] = await Promise.all([
    asUntyped(adminClient).from('accounts').select('id, name, email').in('id', ids),
    asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .select('artist_account_id, invitee_email')
      .eq('exhibition_id', exhibitionId)
      .in('status', [...OPEN_STATUSES, 'consumed']),
  ]);

  const invitedIds = new Set<string>();
  const invitedEmails = new Set<string>();
  for (const inv of (invites ?? []) as Array<{ artist_account_id: string | null; invitee_email: string | null }>) {
    if (inv.artist_account_id) invitedIds.add(inv.artist_account_id);
    if (inv.invitee_email) invitedEmails.add(normalizeInviteEmail(inv.invitee_email));
  }

  return ((accounts ?? []) as Array<{ id: string; name: string | null; email: string | null }>)
    .map((account) => {
      const email = account.email ? normalizeInviteEmail(account.email) : null;
      return {
        artistAccountId: account.id,
        name: account.name?.trim() || 'Artist',
        email,
        hasEmail: !!email,
      };
    })
    .filter(
      (a) => !invitedIds.has(a.artistAccountId) && !(a.email && invitedEmails.has(a.email)),
    );
}

export async function getUninvitedCreditedArtists(
  exhibitionId: string,
): Promise<CreditedArtistInviteStatus[]> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertCanManageExhibition(user.id, exhibitionId);
  const artists = await findUninvitedCreditedArtists(exhibitionId, user.id);
  return artists.map(({ artistAccountId, name, hasEmail }) => ({ artistAccountId, name, hasEmail }));
}

/**
 * Sends the upload invite (email + in-app notification, which triggers push)
 * to credited platform artists. Picking an artist in the participant search
 * only credits them, so without this they never hear about the exhibition.
 * Pass artistAccountIds to limit to newly credited artists.
 */
export async function inviteCreditedArtists(
  exhibitionId: string,
  artistAccountIds?: string[],
): Promise<{ sent: number; skipped: number; noEmail: string[]; errors: string[] }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertCanManageExhibition(user.id, exhibitionId);

  const artists = await findUninvitedCreditedArtists(exhibitionId, user.id, artistAccountIds);
  const noEmail = artists.filter((a) => !a.email).map((a) => a.name);
  const invites = artists
    .filter((a): a is typeof a & { email: string } => !!a.email)
    .map((a) => ({ email: a.email, name: a.name, artistAccountId: a.artistAccountId }));

  console.log('[Exhibitions] inviteCreditedArtists', {
    exhibitionId,
    inviting: invites.length,
    noEmail: noEmail.length,
  });

  if (invites.length === 0) {
    return { sent: 0, skipped: 0, noEmail, errors: [] };
  }

  const result = await createExhibitionArtistInvites(exhibitionId, invites);
  return { ...result, noEmail };
}

export async function updateExhibitionInviteLimit(
  inviteId: string,
  maxArtworks: number | null,
): Promise<{ success: boolean; error?: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const adminClient = getSupabaseServerAdminClient();
  const { data: invite, error: fetchError } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select('id, exhibition_id')
    .eq('id', inviteId)
    .single();
  if (fetchError || !invite) return { success: false, error: 'Invite not found' };

  try {
    await assertCanManageExhibition(user.id, invite.exhibition_id);

    const { error } = await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({ max_artworks: parseMaxArtworksPerArtist(maxArtworks) })
      .eq('id', inviteId);
    if (error) {
      console.error('[Exhibitions] updateExhibitionInviteLimit failed', error);
      return { success: false, error: 'Could not update limit' };
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
  }
}

/**
 * A link-only invite: no email. The organiser copies the link and sends it
 * however they like; the first artist who opens it and signs in claims it.
 * Only for solo and group shows (the artist lands on their show page).
 */
export async function createExhibitionInviteLink(
  exhibitionId: string,
  input: { name?: string | null; maxArtworks?: number | null } = {},
): Promise<{ success: true; url: string; inviteId: string } | { success: false; error: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { showType, defaultMaxArtworks } = await assertCanManageExhibition(user.id, exhibitionId);
    if (showType !== 'solo' && showType !== 'group') {
      return {
        success: false,
        error: 'Invite links are for solo and group shows. Set the kind of show above first.',
      };
    }

    const adminClient = asUntyped(getSupabaseServerAdminClient());
    if (showType === 'solo') {
      const { count } = await adminClient
        .from('exhibition_artist_invites')
        .select('id', { count: 'exact', head: true })
        .eq('exhibition_id', exhibitionId)
        .eq('source', 'invite')
        .in('status', OPEN_STATUSES);
      if ((count ?? 0) > 0) {
        return {
          success: false,
          error: 'This solo show already has an invite. Copy that one’s link, or cancel it first.',
        };
      }
    }

    const creds = newInviteCredentials();
    const maxArtworks =
      input.maxArtworks === undefined ? defaultMaxArtworks : parseMaxArtworksPerArtist(input.maxArtworks);
    const { error } = await adminClient.from('exhibition_artist_invites').insert({
      id: creds.id,
      token_nonce: creds.nonce,
      token_hash: creds.tokenHash,
      exhibition_id: exhibitionId,
      invitee_email: null,
      invitee_name: input.name?.trim() || null,
      max_artworks: maxArtworks,
      status: 'sent',
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      created_by: user.id,
      can_edit_show: showType === 'solo',
    });
    if (error) {
      console.error('[Exhibitions] createExhibitionInviteLink insert failed', error);
      return { success: false, error: 'Could not create the invite link' };
    }

    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    console.log('[Exhibitions] createExhibitionInviteLink created', { exhibitionId, inviteId: creds.id });
    return { success: true, url: getExhibitionSubmitUrl(creds.token), inviteId: creds.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not create the link' };
  }
}

/**
 * The invite's link, to copy and send. Invites made before links existed get
 * a new token here (their emailed link stops working). Unopened invites past
 * their expiry get a fresh expiry, since the organiser is sending it now.
 */
export async function getExhibitionInviteLink(
  inviteId: string,
): Promise<{ success: true; url: string; rotated: boolean } | { success: false; error: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data: invite } = await adminClient
    .from('exhibition_artist_invites')
    .select('id, exhibition_id, status, token_nonce, expires_at')
    .eq('id', inviteId)
    .maybeSingle();
  if (!invite) return { success: false, error: 'Invite not found' };

  try {
    await assertCanManageExhibition(user.id, invite.exhibition_id);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Access denied' };
  }

  if (!['pending', 'sent', 'accepted', 'expired'].includes(invite.status)) {
    return { success: false, error: 'This invite is closed' };
  }

  let nonce = invite.token_nonce as string | null;
  const update: Record<string, unknown> = {};
  if (!nonce) {
    const creds = newInviteCredentials(invite.id);
    nonce = creds.nonce;
    update.token_nonce = creds.nonce;
    update.token_hash = creds.tokenHash;
  }
  if (invite.status === 'expired' || (invite.status !== 'accepted' && new Date(invite.expires_at) < new Date())) {
    update.status = 'sent';
    update.expires_at = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  }
  if (Object.keys(update).length > 0) {
    const { error } = await adminClient.from('exhibition_artist_invites').update(update).eq('id', invite.id);
    if (error) {
      console.error('[Exhibitions] getExhibitionInviteLink update failed', error);
      return { success: false, error: 'Could not prepare the link' };
    }
    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
  }

  return {
    success: true,
    url: getExhibitionSubmitUrl(deriveInviteToken(invite.id, nonce)),
    rotated: Boolean(update.token_hash),
  };
}
