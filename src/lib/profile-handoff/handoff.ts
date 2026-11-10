import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendNotificationEmail } from '~/lib/email';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { getProfileHandoffUrl } from '~/lib/certificate-claims/site-url';
import {
  emailsMatch,
  generateClaimToken,
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import { canHandOffProfile, isManagedArtistOf } from '~/lib/managed-collections';
import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import { inviteIsForUser, resolveHandoffTarget } from './target';

/**
 * Handing a managed profile over to the person it belongs to.
 *
 * - Managed collection (collector profile built for a client): its Certificates of Ownership
 *   move to the recipient's account.
 * - Managed artist (artist profile an artist manager built): the Certificates of Authenticity
 *   the manager issued move to the artist and become verified. They are the artist's own
 *   COAs, not linked to any gallery or collector certificate.
 *
 * If the recipient already has a claimed profile of that role, the works merge into it and the
 * managed profile is retired; otherwise the managed profile itself becomes theirs.
 */

export const HANDOFF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PROFILE_COLUMNS =
  'id, user_id, role, name, is_claimed, is_active, created_by_gallery_id, managed_for_name, managed_for_email';

export type HandoffProfile = {
  id: string;
  user_id: string | null;
  role: string;
  name: string;
  is_claimed: boolean;
  is_active: boolean;
  created_by_gallery_id: string | null;
  managed_for_name: string | null;
  managed_for_email: string | null;
};

export type OpenHandoffInvite = {
  profileId: string;
  status: 'sent' | 'declined';
  /** Email the invite went to; null when it targets an account picked by search */
  email: string | null;
  recipientUserId: string | null;
  /** Display name of the account it was sent to, when it targets one */
  recipientName: string | null;
  sentAt: string;
};

function admin(): UntypedSupabaseClient {
  return asUntyped(getSupabaseServerAdminClient());
}

async function loadProfile(db: UntypedSupabaseClient, profileId: string): Promise<HandoffProfile | null> {
  const { data } = await db.from('user_profiles').select(PROFILE_COLUMNS).eq('id', profileId).maybeSingle();
  return (data as HandoffProfile | null) ?? null;
}

/** Works the builder posted into the managed profile, which move with it. */
function builderWorksQuery(db: UntypedSupabaseClient, profile: HandoffProfile, builderId: string) {
  const query = db.from('artworks').select('id', { count: 'exact', head: true }).eq('account_id', builderId);
  return profile.role === USER_ROLES.ARTIST
    ? query.eq('artist_profile_id', profile.id).eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
    : query.eq('gallery_profile_id', profile.id);
}

type InviteRow = {
  id: string;
  profile_id: string;
  invitee_email: string | null;
  recipient_user_id: string | null;
  status: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
};

async function accountNames(db: UntypedSupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await db.from('accounts').select('id, name').in('id', unique);
  const names: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; name: string | null }[]) {
    if (row.name) names[row.id] = row.name;
  }
  return names;
}

/**
 * Latest live or declined invite per profile, for the builder's list of managed profiles.
 * A newer cancelled/consumed invite hides an older declined one.
 */
export async function getOpenHandoffInvites(profileIds: string[]): Promise<Record<string, OpenHandoffInvite>> {
  if (profileIds.length === 0) return {};
  const db = admin();
  const { data, error } = await db
    .from('profile_handoff_invites')
    .select('profile_id, invitee_email, recipient_user_id, status, created_at, expires_at')
    .in('profile_id', profileIds)
    .in('status', ['sent', 'declined', 'cancelled'])
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('profile_handoff_open_invites_failed', { error });
    return {};
  }
  const rows = (data ?? []) as InviteRow[];
  const now = new Date();
  const latest: Record<string, InviteRow> = {};
  for (const row of rows) {
    if (!latest[row.profile_id]) latest[row.profile_id] = row;
  }
  const names = await accountNames(
    db,
    Object.values(latest).map((r) => r.recipient_user_id ?? ''),
  );
  const result: Record<string, OpenHandoffInvite> = {};
  for (const row of Object.values(latest)) {
    if (row.status === 'cancelled') continue;
    if (row.status === 'sent' && new Date(row.expires_at) < now) continue;
    result[row.profile_id] = {
      profileId: row.profile_id,
      status: row.status === 'declined' ? 'declined' : 'sent',
      email: row.invitee_email,
      recipientUserId: row.recipient_user_id,
      recipientName: row.recipient_user_id ? (names[row.recipient_user_id] ?? null) : null,
      sentAt: row.created_at,
    };
  }
  return result;
}

export type SendHandoffResult =
  | { success: true; email: string | null; recipientName: string | null }
  | { success: false; error: string };

export async function sendProfileHandoffInvite(params: {
  builderId: string;
  builderEmail: string | null | undefined;
  builderName: string | null | undefined;
  profileId: string;
  email?: string;
  /** An existing account picked by search; takes precedence over email */
  recipientUserId?: string;
}): Promise<SendHandoffResult> {
  const db = admin();
  const profile = await loadProfile(db, params.profileId);
  if (!profile || !canHandOffProfile(profile, params.builderId)) {
    return { success: false, error: 'You can only hand over profiles you manage' };
  }

  const resolved = resolveHandoffTarget({
    email: params.email,
    recipientUserId: params.recipientUserId,
    fallbackEmail: profile.managed_for_email,
  });
  if (!resolved.ok) return { success: false, error: resolved.error };
  const target = resolved.target;

  // Where the email goes, and who (if anyone) it is pinned to.
  let email: string | null = null;
  let recipientUserId: string | null = null;
  let recipientName: string | null = null;

  if (target.kind === 'user') {
    if (target.userId === params.builderId) {
      return { success: false, error: 'Pick the person you are handing this to, not yourself' };
    }
    const { data: account } = await db
      .from('accounts')
      .select('id, name, email')
      .eq('id', target.userId)
      .maybeSingle();
    if (!account) return { success: false, error: 'That account could not be found' };
    recipientUserId = account.id as string;
    recipientName = (account.name as string | null) ?? null;
    email = account.email ? normalizeInviteEmail(account.email as string) : null;
  } else {
    email = target.email;
    if (params.builderEmail && emailsMatch(params.builderEmail, email)) {
      return { success: false, error: 'Send the invite to their email, not yours' };
    }
    if (email !== profile.managed_for_email) {
      await db.from('user_profiles').update({ managed_for_email: email }).eq('id', profile.id);
    }
    // If that email already belongs to an account, pin the invite to it so it shows in their inbox.
    const { data: existing } = await db
      .from('accounts')
      .select('id, name')
      .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();
    if (existing?.id && existing.id !== params.builderId) {
      recipientUserId = existing.id as string;
      recipientName = (existing.name as string | null) ?? null;
    }
  }

  // One live invite per profile: a resend replaces the earlier link.
  await db
    .from('profile_handoff_invites')
    .update({ status: 'cancelled' })
    .eq('profile_id', profile.id)
    .eq('status', 'sent');

  const token = generateClaimToken();
  const { data: inserted, error: insertError } = await db
    .from('profile_handoff_invites')
    .insert({
      profile_id: profile.id,
      invitee_email: email,
      recipient_user_id: recipientUserId,
      token_hash: hashClaimToken(token),
      status: 'sent',
      expires_at: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
      created_by: params.builderId,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    logger.error('profile_handoff_insert_failed', { profileId: profile.id, error: insertError });
    return { success: false, error: 'Could not create the invite' };
  }

  const { count } = await builderWorksQuery(db, profile, params.builderId);
  const works = count ?? 0;
  const worksLine = works === 1 ? '1 work' : `${works} works`;
  const from = params.builderName?.trim() || 'Someone';
  const isArtist = profile.role === USER_ROLES.ARTIST;
  const name = profile.managed_for_name || profile.name;
  const url = getProfileHandoffUrl(token);

  console.log('[Handoff] sendProfileHandoffInvite', {
    profileId: profile.id,
    role: profile.role,
    works,
    target: target.kind,
    pinnedToAccount: Boolean(recipientUserId),
  });

  if (recipientUserId) {
    try {
      await createNotification({
        userId: recipientUserId,
        type: 'profile_handoff_received',
        title: isArtist
          ? `${from} added ${worksLine} under your name`
          : `${from} catalogued a collection for you`,
        message: isArtist
          ? `Review and accept the Certificates of Authenticity for ${worksLine}. They join your artist profile only if you accept.`
          : `"${name}" has ${worksLine} with Certificates of Ownership. Accept it into your account or decline.`,
        relatedUserId: params.builderId,
        metadata: { inviteId: inserted.id, profileId: profile.id },
      });
    } catch (error) {
      logger.error('profile_handoff_recipient_inapp_notify_failed', { error });
    }
  }

  if (email) {
    try {
      await sendNotificationEmail(
        email,
        recipientName || name,
        isArtist
          ? `${from} issued Certificates of Authenticity for your work`
          : `${from} catalogued your collection on Provenance`,
        isArtist
          ? {
              title: 'Accept your Certificates of Authenticity',
              body: `${from} has posted ${worksLine} under your name on Provenance and issued a Certificate of Authenticity for each. Sign in with this email address to review them. If you accept, they become your own certificates, held in your account and not tied to any gallery or collector. You can also decline.`,
              ctaUrl: url,
              ctaLabel: 'Review certificates',
            }
          : {
              title: 'Accept your collection',
              body: `${from} has catalogued ${worksLine} for "${name}" on Provenance, each with a Certificate of Ownership in your name. Sign in with this email address to accept the collection into your own account, or decline it.`,
              ctaUrl: url,
              ctaLabel: 'Review collection',
            },
        { strict: true },
      );
    } catch (error) {
      logger.error('profile_handoff_email_failed', { profileId: profile.id, error });
      // An account-pinned invite still works from the in-app inbox.
      if (!recipientUserId) {
        return { success: false, error: 'The invite was saved but the email failed to send. Try again.' };
      }
    }
  }

  return { success: true, email, recipientName };
}

export type HandoffPreview =
  | {
      ok: true;
      role: 'artist' | 'collector';
      name: string;
      /** Email the invite was sent to, or null when it was sent to an account */
      inviteeEmail: string | null;
      /** Set when the invite was sent to a specific account */
      recipientName: string | null;
      fromName: string | null;
      works: number;
      /** Whether the signed-in viewer is who it was sent to; null when signed out */
      isForViewer: boolean | null;
    }
  | { ok: false; error: string };

async function loadInviteByToken(db: UntypedSupabaseClient, token: string): Promise<InviteRow | null> {
  if (!token) return null;
  const { data } = await db
    .from('profile_handoff_invites')
    .select('*')
    .eq('token_hash', hashClaimToken(token))
    .maybeSingle();
  return (data as InviteRow | null) ?? null;
}

async function loadInviteById(db: UntypedSupabaseClient, inviteId: string): Promise<InviteRow | null> {
  if (!inviteId) return null;
  const { data } = await db.from('profile_handoff_invites').select('*').eq('id', inviteId).maybeSingle();
  return (data as InviteRow | null) ?? null;
}

function inviteProblem(invite: InviteRow | null): string | null {
  if (!invite) return 'This invite link is not valid';
  if (invite.status === 'consumed') return 'This invite has already been accepted';
  if (invite.status === 'declined') return 'This invite was declined';
  if (invite.status !== 'sent') return 'This invite is no longer valid. Ask for a new one.';
  const expires = new Date(invite.expires_at ?? '');
  if (Number.isNaN(expires.getTime()) || expires < new Date()) return 'This invite has expired. Ask for a new one.';
  return null;
}

function wrongRecipientError(invite: InviteRow, recipientName: string | null): string {
  if (invite.recipient_user_id) {
    return recipientName
      ? `This invite was sent to ${recipientName}'s account. Sign in as them to accept it.`
      : 'This invite was sent to a different account.';
  }
  return `Sign in with the email this invite was sent to (${invite.invitee_email}).`;
}

async function previewForInvite(
  db: UntypedSupabaseClient,
  invite: InviteRow,
  viewer?: { id: string; email?: string | null } | null,
): Promise<HandoffPreview> {
  const profile = await loadProfile(db, invite.profile_id);
  const builderId = invite.created_by;
  if (!profile || !builderId || !canHandOffProfile(profile, builderId)) {
    return { ok: false, error: 'This profile has already been handed over' };
  }
  const [{ count }, names] = await Promise.all([
    builderWorksQuery(db, profile, builderId),
    accountNames(db, [builderId, invite.recipient_user_id ?? '']),
  ]);
  return {
    ok: true,
    role: profile.role === USER_ROLES.ARTIST ? 'artist' : 'collector',
    name: profile.managed_for_name || profile.name,
    inviteeEmail: invite.invitee_email,
    recipientName: invite.recipient_user_id ? (names[invite.recipient_user_id] ?? null) : null,
    fromName: names[builderId] ?? null,
    works: count ?? 0,
    isForViewer: viewer ? inviteIsForUser(invite, viewer) : null,
  };
}

export async function getProfileHandoffPreview(
  token: string,
  viewer?: { id: string; email?: string | null } | null,
): Promise<HandoffPreview> {
  const db = admin();
  const invite = await loadInviteByToken(db, token);
  const problem = inviteProblem(invite);
  if (problem) return { ok: false, error: problem };
  return previewForInvite(db, invite!, viewer);
}

export type IncomingHandoff = {
  inviteId: string;
  role: 'artist' | 'collector';
  name: string;
  fromName: string | null;
  works: number;
  sentAt: string;
};

/** Live handoffs waiting for this user: pinned to their account, or sent to their email. */
export async function getIncomingHandoffInvites(user: { id: string; email?: string | null }): Promise<IncomingHandoff[]> {
  const db = admin();
  const filters = [`recipient_user_id.eq.${user.id}`];
  const email = user.email ? normalizeInviteEmail(user.email) : '';
  // Emails are stored normalized; skip any with characters that would break the filter syntax.
  if (email && /^[^,()\s]+$/.test(email)) filters.push(`invitee_email.eq.${email}`);

  const { data, error } = await db
    .from('profile_handoff_invites')
    .select('*')
    .eq('status', 'sent')
    .gt('expires_at', new Date().toISOString())
    .or(filters.join(','))
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('profile_handoff_incoming_failed', { error });
    return [];
  }

  const incoming: IncomingHandoff[] = [];
  for (const invite of (data ?? []) as InviteRow[]) {
    if (!inviteIsForUser(invite, user) || invite.created_by === user.id) continue;
    const preview = await previewForInvite(db, invite);
    if (!preview.ok) continue;
    incoming.push({
      inviteId: invite.id,
      role: preview.role,
      name: preview.name,
      fromName: preview.fromName,
      works: preview.works,
      sentAt: invite.created_at,
    });
  }
  return incoming;
}

/**
 * After signup: pin email-only invites for this address to the new account, so they show in
 * the in-app inbox even if the email link is lost.
 */
export async function attachPendingHandoffsToUser(user: { id: string; email?: string | null }): Promise<number> {
  if (!user.email) return 0;
  const email = normalizeInviteEmail(user.email);
  const { data, error } = await admin()
    .from('profile_handoff_invites')
    .update({ recipient_user_id: user.id })
    .eq('status', 'sent')
    .eq('invitee_email', email)
    .is('recipient_user_id', null)
    .select('id');
  if (error) {
    logger.error('profile_handoff_attach_failed', { error });
    return 0;
  }
  return data?.length ?? 0;
}

export type ConsumeHandoffResult =
  | { success: true; profileId: string; role: 'artist' | 'collector'; works: number }
  | { success: false; error: string };

export type TransferResult =
  | { success: true; profileId: string; role: 'artist' | 'collector'; works: number }
  | { success: false; error: string };

/**
 * Move a managed profile and the works the builder posted into it to `user`.
 *
 * Artist: the builder's COAs become the artist's own verified certificates. Collection: the
 * works and Certificates of Ownership move. If the user already has a claimed profile of that
 * role the works merge into it and the managed profile is retired; otherwise the managed
 * profile itself becomes theirs. Notifies both sides.
 *
 * Callers must already have authorised the transfer (a consumed invite or an approved claim).
 */
export async function transferManagedProfile(
  profile: HandoffProfile,
  builderId: string,
  user: { id: string },
): Promise<TransferResult> {
  const db = admin();
  const isArtist = isManagedArtistOf(profile, builderId);
  const role = isArtist ? USER_ROLES.ARTIST : USER_ROLES.COLLECTOR;
  const now = new Date().toISOString();

  // The recipient's own claimed profile of this role, if they already have one.
  const { data: existing } = await db
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', role)
    .eq('is_claimed', true)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const targetProfileId = (existing?.id as string | undefined) ?? profile.id;

  console.log('[Handoff] transferManagedProfile', {
    profileId: profile.id,
    role,
    mergeIntoExisting: Boolean(existing?.id),
  });

  let works = 0;

  if (isArtist) {
    const { data: moved, error: moveError } = await db
      .from('artworks')
      .update({
        account_id: user.id,
        artist_account_id: user.id,
        artist_profile_id: targetProfileId,
        certificate_status: 'verified',
        // Held private while waiting for the artist; accepting is their go-ahead to show them.
        is_public: true,
        updated_by: user.id,
      })
      .eq('account_id', builderId)
      .eq('artist_profile_id', profile.id)
      .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
      .select('id');
    if (moveError) {
      logger.error('profile_handoff_move_artist_works_failed', { profileId: profile.id, error: moveError });
      return { success: false, error: 'Could not move the certificates. Please try again.' };
    }
    works = moved?.length ?? 0;

    // Other people's certificates that credit this artist profile now point at the artist.
    await db
      .from('artworks')
      .update({ artist_profile_id: targetProfileId, artist_account_id: user.id })
      .eq('artist_profile_id', profile.id)
      .is('artist_account_id', null);
  } else {
    const { data: moved, error: moveError } = await db
      .from('artworks')
      .update({ account_id: user.id, gallery_profile_id: targetProfileId, updated_by: user.id })
      .eq('account_id', builderId)
      .eq('gallery_profile_id', profile.id)
      .select('id');
    if (moveError) {
      logger.error('profile_handoff_move_collection_works_failed', { profileId: profile.id, error: moveError });
      return { success: false, error: 'Could not move the collection. Please try again.' };
    }
    works = moved?.length ?? 0;
  }

  if (existing?.id) {
    await db.from('user_profiles').update({ is_active: false, updated_at: now }).eq('id', profile.id);
  } else {
    await db
      .from('user_profiles')
      .update({ user_id: user.id, is_claimed: true, claimed_at: now, updated_at: now })
      .eq('id', profile.id);
  }

  // Someone who signed up through the link has no role yet; give them the one they accepted.
  const { data: account } = await db.from('accounts').select('public_data').eq('id', user.id).maybeSingle();
  const publicData = (account?.public_data as Record<string, unknown> | null) ?? {};
  if (!publicData.role) {
    await db
      .from('accounts')
      .update({ public_data: { ...publicData, role } })
      .eq('id', user.id);
  }

  const name = profile.managed_for_name || profile.name;
  const worksLine = works === 1 ? '1 work' : `${works} works`;
  try {
    await createNotification({
      userId: builderId,
      type: 'certificate_claimed',
      title: isArtist ? `${name} accepted their certificates` : `${name} accepted their collection`,
      message: isArtist
        ? `${name} accepted ${worksLine} you posted. The Certificates of Authenticity are now in their account.`
        : `${name} accepted the collection you catalogued (${worksLine}). It is now in their account.`,
      relatedUserId: user.id,
      metadata: { profileId: targetProfileId },
    });
  } catch (error) {
    logger.error('profile_handoff_builder_notify_failed', { error });
  }
  try {
    await createNotification({
      userId: user.id,
      type: 'certificate_received',
      title: isArtist ? 'Your Certificates of Authenticity are ready' : 'Your collection is ready',
      message: isArtist
        ? `${worksLine} with Certificates of Authenticity were added to your account.`
        : `${worksLine} with Certificates of Ownership were added to your account.`,
      relatedUserId: builderId,
      metadata: { profileId: targetProfileId },
    });
  } catch (error) {
    logger.error('profile_handoff_recipient_notify_failed', { error });
  }

  return { success: true, profileId: targetProfileId, role: isArtist ? 'artist' : 'collector', works };
}

async function acceptInvite(
  db: UntypedSupabaseClient,
  invite: InviteRow | null,
  user: { id: string; email?: string | null },
): Promise<ConsumeHandoffResult> {
  const problem = inviteProblem(invite);
  if (problem) return { success: false, error: problem };

  if (!inviteIsForUser(invite, user)) {
    const names = await accountNames(db, [invite!.recipient_user_id ?? '']);
    return { success: false, error: wrongRecipientError(invite!, names[invite!.recipient_user_id ?? ''] ?? null) };
  }

  const builderId = invite!.created_by;
  if (!builderId || builderId === user.id) {
    return { success: false, error: 'You cannot accept your own invite' };
  }

  const profile = await loadProfile(db, invite!.profile_id);
  if (!profile || !canHandOffProfile(profile, builderId)) {
    return { success: false, error: 'This profile has already been handed over' };
  }

  // Claim the invite first so a double click can't move the works twice.
  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from('profile_handoff_invites')
    .update({ status: 'consumed', consumed_by: user.id, consumed_at: now })
    .eq('id', invite!.id)
    .eq('status', 'sent')
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { success: false, error: 'This invite has already been accepted' };
  }

  const result = await transferManagedProfile(profile, builderId, user);
  if (!result.success) {
    await db
      .from('profile_handoff_invites')
      .update({ status: 'sent', consumed_by: null, consumed_at: null })
      .eq('id', invite!.id);
  }
  return result;
}

export async function consumeProfileHandoff(
  token: string,
  user: { id: string; email?: string | null },
): Promise<ConsumeHandoffResult> {
  const db = admin();
  return acceptInvite(db, await loadInviteByToken(db, token), user);
}

/** Accept a handoff from the in-app inbox. */
export async function acceptProfileHandoffById(
  inviteId: string,
  user: { id: string; email?: string | null },
): Promise<ConsumeHandoffResult> {
  const db = admin();
  return acceptInvite(db, await loadInviteById(db, inviteId), user);
}

export type DeclineHandoffResult = { success: true } | { success: false; error: string };

async function declineInvite(
  db: UntypedSupabaseClient,
  invite: InviteRow | null,
  user: { id: string; email?: string | null },
): Promise<DeclineHandoffResult> {
  const problem = inviteProblem(invite);
  if (problem) return { success: false, error: problem };
  if (!inviteIsForUser(invite, user)) {
    return { success: false, error: 'This invite was sent to someone else' };
  }

  const now = new Date().toISOString();
  const { data: declined } = await db
    .from('profile_handoff_invites')
    .update({ status: 'declined', declined_at: now, consumed_by: user.id })
    .eq('id', invite!.id)
    .eq('status', 'sent')
    .select('id');
  if (!declined || declined.length === 0) {
    return { success: false, error: 'This invite is no longer open' };
  }

  const profile = await loadProfile(db, invite!.profile_id);
  if (invite!.created_by && profile) {
    const isArtist = profile.role === USER_ROLES.ARTIST;
    const name = profile.managed_for_name || profile.name;
    const names = await accountNames(db, [user.id]);
    const who = names[user.id] || name;
    try {
      await createNotification({
        userId: invite!.created_by,
        type: 'profile_handoff_declined',
        title: isArtist ? `${who} declined the certificates` : `${who} declined the collection`,
        message: isArtist
          ? `The works you posted for ${name} stay in your account. You can edit them or send them to someone else.`
          : `"${name}" stays in your account. You can edit it or hand it to someone else.`,
        relatedUserId: user.id,
        metadata: { profileId: profile.id, inviteId: invite!.id },
      });
    } catch (error) {
      logger.error('profile_handoff_decline_notify_failed', { error });
    }
  }

  console.log('[Handoff] declined', { inviteId: invite!.id });
  return { success: true };
}

export async function declineProfileHandoffById(
  inviteId: string,
  user: { id: string; email?: string | null },
): Promise<DeclineHandoffResult> {
  const db = admin();
  return declineInvite(db, await loadInviteById(db, inviteId), user);
}

export async function declineProfileHandoffByToken(
  token: string,
  user: { id: string; email?: string | null },
): Promise<DeclineHandoffResult> {
  const db = admin();
  return declineInvite(db, await loadInviteByToken(db, token), user);
}

/** Withdraw a live invite the builder sent. */
export async function cancelProfileHandoff(profileId: string, builderId: string): Promise<DeclineHandoffResult> {
  const db = admin();
  const profile = await loadProfile(db, profileId);
  if (!profile || !canHandOffProfile(profile, builderId)) {
    return { success: false, error: 'You can only manage invites for profiles you built' };
  }
  await db
    .from('profile_handoff_invites')
    .update({ status: 'cancelled' })
    .eq('profile_id', profileId)
    .in('status', ['sent', 'declined']);
  return { success: true };
}
