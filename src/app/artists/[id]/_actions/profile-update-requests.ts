'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { createNotification } from '~/lib/notifications';
import { sendNotificationEmail } from '~/lib/email';
import { logger } from '~/lib/logger';
import { getBlockedUserIds } from '~/lib/moderation/blocks';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import {
  MAX_OPEN_REQUESTS_PER_REQUESTER,
  MAX_REQUEST_MESSAGE,
  canRequestUpdateFrom,
  describeRequestedFields,
  fulfilHrefForField,
  sanitizeRequestedFields,
  type RequestableField,
} from '~/lib/artist-profile-content/fields';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
}

/**
 * The artist's display name, and the profile to attach (when given, it must be one of
 * their artist profiles). Null when the account isn't an artist.
 */
async function resolveArtist(
  admin: UntypedSupabaseClient,
  artistAccountId: string,
  profileId: string | null,
): Promise<{ name: string; profileId: string | null } | null> {
  const [{ data: account }, { data: profiles }] = await Promise.all([
    admin.from('accounts').select('id, name, public_data').eq('id', artistAccountId).maybeSingle(),
    admin
      .from('user_profiles')
      .select('id, name')
      .eq('user_id', artistAccountId)
      .eq('role', USER_ROLES.ARTIST)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ]);
  if (!account) return null;
  const artistProfiles = (profiles ?? []) as { id: string; name: string | null }[];
  const isArtist =
    artistProfiles.length > 0 || getUserRole(account.public_data as Record<string, unknown>) === USER_ROLES.ARTIST;
  if (!isArtist) return null;
  const profile = profileId ? artistProfiles.find((p) => p.id === profileId) : artistProfiles[0];
  if (profileId && !profile) return null;
  return {
    name: profile?.name || (account.name as string | null) || 'the artist',
    profileId: profile?.id ?? null,
  };
}

/**
 * Ask an artist to add or update parts of their profile (CV, statement,
 * exhibition history, bio, header image). The artist gets an in-app
 * notification and an email, and can mark it done or dismiss it. One open
 * request per person per artist: sending again updates it.
 */
export async function requestArtistProfileUpdate(input: {
  artistAccountId: string;
  profileId?: string | null;
  fields: string[];
  message?: string;
}): Promise<Result<{ updated: boolean }>> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return { success: false, error: 'Sign in to send a request.' };
  if (!canRequestUpdateFrom(input.artistAccountId, user.id)) {
    return { success: false, error: 'You cannot send a request to yourself.' };
  }

  const fields = sanitizeRequestedFields(input.fields);
  if (fields.length === 0) return { success: false, error: 'Choose at least one thing to ask for.' };
  const message = input.message?.trim().slice(0, MAX_REQUEST_MESSAGE) || null;
  if (containsObjectionableText(message)) return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const artistUserId = input.artistAccountId;
  const artist = await resolveArtist(admin, artistUserId, input.profileId ?? null);
  if (!artist) return { success: false, error: 'You can only send requests to artists on Provenance.' };

  // Respect blocks in either direction.
  const { data: blocks } = await admin
    .from('user_blocks')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${artistUserId}),and(blocker_id.eq.${artistUserId},blocked_id.eq.${user.id})`,
    )
    .limit(1);
  if ((blocks ?? []).length > 0) {
    return { success: false, error: 'You cannot send requests to this artist.' };
  }

  const { data: existing } = await admin
    .from('artist_profile_update_requests')
    .select('id')
    .eq('artist_account_id', artistUserId)
    .eq('requested_by', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!existing) {
    const { count } = await admin
      .from('artist_profile_update_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requested_by', user.id)
      .eq('status', 'pending');
    if ((count ?? 0) >= MAX_OPEN_REQUESTS_PER_REQUESTER) {
      return { success: false, error: 'You have too many open requests. Wait for some artists to respond first.' };
    }
  }

  const row = {
    artist_account_id: artistUserId,
    profile_id: artist.profileId,
    requested_by: user.id,
    requested_fields: fields,
    message,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = existing
    ? await admin.from('artist_profile_update_requests').update(row).eq('id', existing.id).select('id').single()
    : await admin.from('artist_profile_update_requests').insert(row).select('id').single();
  if (error || !saved) {
    logger.error('artist_profile_update_request_save_failed', { artistUserId, error });
    return { success: false, error: 'Could not send the request. Please try again.' };
  }

  const { data: requester } = await admin.from('accounts').select('name').eq('id', user.id).maybeSingle();
  const from = (requester?.name as string | undefined)?.trim() || 'Someone on Provenance';
  const what = describeRequestedFields(fields).toLowerCase();
  const body = `${from} asked you to add or update your ${what} on Provenance.${message ? ` Their note: "${message}"` : ''}`;

  try {
    await createNotification({
      userId: artistUserId,
      type: 'artist_profile_update_request',
      title: `${from} asked you to update your profile`,
      message: body,
      relatedUserId: user.id,
      metadata: { request_id: saved.id, profile_id: artist.profileId, fields },
    });
  } catch (e) {
    logger.error('artist_profile_update_request_notify_failed', { error: e });
  }
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(artistUserId);
    const email = authUser?.user?.email;
    if (email) {
      await sendNotificationEmail(email, artist.name, `${from} asked you to update your artist profile`, {
        title: 'A request to update your profile',
        body,
        ctaUrl: `${siteUrl()}/profiles/suggestions`,
        ctaLabel: 'See the request',
      });
    }
  } catch (e) {
    logger.error('artist_profile_update_request_email_failed', { error: e });
  }

  console.log('[ProfileUpdateRequests] sent', {
    requestId: saved.id,
    artistUserId,
    profileId: artist.profileId,
    fields,
    refreshed: Boolean(existing),
  });
  return { success: true, updated: Boolean(existing) };
}

/** The signed-in user's open request to this artist, for the button's state. */
export async function getMyOpenProfileUpdateRequest(
  artistAccountId: string,
): Promise<{ id: string; fields: RequestableField[]; message: string | null; createdAt: string } | null> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client
    .from('artist_profile_update_requests')
    .select('id, requested_fields, message, created_at')
    .eq('artist_account_id', artistAccountId)
    .eq('requested_by', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    fields: sanitizeRequestedFields(data.requested_fields),
    message: (data.message as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

export type IncomingProfileUpdateRequest = {
  id: string;
  profileName: string | null;
  requestedByName: string | null;
  requestedById: string;
  fields: RequestableField[];
  links: { field: RequestableField; href: string }[];
  message: string | null;
  createdAt: string;
};

/** Open update requests sent to the signed-in artist. */
export async function getMyIncomingProfileUpdateRequests(): Promise<IncomingProfileUpdateRequest[]> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await client
    .from('artist_profile_update_requests')
    .select('id, profile_id, requested_by, requested_fields, message, created_at')
    .eq('artist_account_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('artist_profile_update_requests_load_failed', { error });
    return [];
  }
  const blocked = await getBlockedUserIds(user.id);
  const list = (
    (rows ?? []) as {
      id: string;
      profile_id: string | null;
      requested_by: string;
      requested_fields: string[];
      message: string | null;
      created_at: string;
    }[]
  ).filter((r) => !blocked.has(r.requested_by));
  if (list.length === 0) return [];

  const admin = asUntyped(getSupabaseServerAdminClient());
  const names = new Map<string, string>();
  const { data: accounts } = await admin
    .from('accounts')
    .select('id, name')
    .in('id', [...new Set(list.map((r) => r.requested_by))]);
  for (const a of (accounts ?? []) as { id: string; name: string | null }[]) if (a.name) names.set(a.id, a.name);

  const profileIds = [...new Set(list.map((r) => r.profile_id).filter(Boolean))] as string[];
  const profileNames = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await client.from('user_profiles').select('id, name').in('id', profileIds);
    for (const p of (profiles ?? []) as { id: string; name: string | null }[]) if (p.name) profileNames.set(p.id, p.name);
  }

  return list.map((r) => {
    const fields = sanitizeRequestedFields(r.requested_fields);
    return {
      id: r.id,
      profileName: r.profile_id ? (profileNames.get(r.profile_id) ?? null) : null,
      requestedByName: names.get(r.requested_by) ?? null,
      requestedById: r.requested_by,
      fields,
      links: fields.map((field) => ({
        field,
        href: fulfilHrefForField(field, { artistAccountId: user.id, profileId: r.profile_id }),
      })),
      message: r.message,
      createdAt: r.created_at,
    };
  });
}

/** The artist marks a request done (they updated their profile) or dismisses it. */
export async function respondToProfileUpdateRequest(input: {
  requestId: string;
  decision: 'fulfilled' | 'dismissed';
  responseMessage?: string;
}): Promise<Result> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return { success: false, error: 'Sign in to respond.' };
  if (input.decision !== 'fulfilled' && input.decision !== 'dismissed') {
    return { success: false, error: 'Unknown response.' };
  }
  const responseMessage = input.responseMessage?.trim().slice(0, MAX_REQUEST_MESSAGE) || null;
  if (containsObjectionableText(responseMessage)) return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: request } = await admin
    .from('artist_profile_update_requests')
    .select('id, artist_account_id, profile_id, requested_by, requested_fields, status')
    .eq('id', input.requestId)
    .maybeSingle();
  if (!request || request.artist_account_id !== user.id) {
    return { success: false, error: 'Request not found.' };
  }

  // Only a pending request moves, so a double click can't notify twice.
  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('artist_profile_update_requests')
    .update({ status: input.decision, responded_at: now, response_message: responseMessage, updated_at: now })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id');
  if (error) {
    logger.error('artist_profile_update_request_respond_failed', { requestId: request.id, error });
    return { success: false, error: 'Could not save your response.' };
  }
  if (!updated || updated.length === 0) return { success: false, error: 'This request was already answered.' };

  const artist = await resolveArtist(admin, user.id, null);
  const artistName = artist?.name || 'The artist';
  const what = describeRequestedFields(sanitizeRequestedFields(request.requested_fields)).toLowerCase();
  try {
    await createNotification({
      userId: request.requested_by as string,
      type:
        input.decision === 'fulfilled'
          ? 'artist_profile_update_request_fulfilled'
          : 'artist_profile_update_request_dismissed',
      title: input.decision === 'fulfilled' ? `${artistName} updated their profile` : `${artistName} dismissed your request`,
      message:
        responseMessage ??
        (input.decision === 'fulfilled'
          ? `${artistName} marked your request for their ${what} as done.`
          : `${artistName} won't be updating their ${what} for now.`),
      relatedUserId: user.id,
      metadata: { request_id: request.id, profile_id: request.profile_id, artist_user_id: user.id },
    });
  } catch (e) {
    logger.error('artist_profile_update_request_response_notify_failed', { error: e });
  }

  console.log('[ProfileUpdateRequests] responded', { requestId: request.id, decision: input.decision });
  revalidatePath('/profiles/suggestions');
  revalidatePath(`/artists/${user.id}`);
  return { success: true };
}
