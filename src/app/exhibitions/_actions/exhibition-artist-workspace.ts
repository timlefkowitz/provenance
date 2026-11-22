'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { emailsMatch, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import {
  invitedWorkGoesStraightIn,
  isShowField,
  normalizeShowFieldValue,
  parseFieldSources,
  parsePlannedPieceCount,
  parseShowType,
  planArtistShowEdit,
  SHOW_FIELD_LABELS,
  type FieldSources,
  type ShowField,
  type ShowType,
  type ShowValues,
} from '../_helpers/show-collaboration';
import { notifyExhibitionOrganisers } from '../_helpers/notify-exhibition-organisers';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

type AcceptedInvite = {
  id: string;
  exhibition_id: string;
  /** Null only for a link-only invite nobody has claimed yet. */
  invitee_email: string | null;
  invitee_name: string | null;
  status: string;
  source: string;
  max_artworks: number | null;
  submitted_count: number;
  planned_piece_count: number | null;
  artist_notes: string | null;
  can_edit_show: boolean;
  accepted_by: string | null;
  expires_at: string;
};

const INVITE_COLUMNS =
  'id, exhibition_id, invitee_email, invitee_name, status, source, max_artworks, submitted_count, planned_piece_count, artist_notes, can_edit_show, accepted_by, expires_at';

const EXHIBITION_COLUMNS =
  'id, gallery_id, title, description, start_date, end_date, location, image_url, show_type, field_sources, published_at';

type ExhibitionRow = {
  id: string;
  gallery_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
  show_type: string | null;
  field_sources: unknown;
  published_at: string | null;
};

function showValues(e: ExhibitionRow): ShowValues {
  return {
    title: e.title,
    description: e.description,
    start_date: e.start_date,
    end_date: e.end_date,
    location: e.location,
    image_url: e.image_url,
  };
}

async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

async function artistDisplayName(
  admin: UntypedSupabaseClient,
  userId: string,
  invite: { invitee_name: string | null; invitee_email: string | null },
): Promise<string> {
  const { data } = await admin.from('accounts').select('name').eq('id', userId).maybeSingle();
  return (
    (data?.name as string | null)?.trim() ||
    invite.invitee_name?.trim() ||
    invite.invitee_email?.split('@')[0] ||
    'The artist'
  );
}

/** The signed-in artist's accepted invite to this show, plus the show. */
async function loadArtistContext(exhibitionId: string): Promise<
  | {
      ok: true;
      userId: string;
      admin: UntypedSupabaseClient;
      invite: AcceptedInvite;
      exhibition: ExhibitionRow;
    }
  | { ok: false; error: string }
> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Sign in to continue' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: invite } = await admin
    .from('exhibition_artist_invites')
    .select(INVITE_COLUMNS)
    .eq('exhibition_id', exhibitionId)
    .eq('accepted_by', user.id)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invite) return { ok: false, error: 'You don’t have an open invitation to this show' };

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select(EXHIBITION_COLUMNS)
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return { ok: false, error: 'Exhibition not found' };

  return {
    ok: true,
    userId: user.id,
    admin,
    invite: invite as AcceptedInvite,
    exhibition: exhibition as ExhibitionRow,
  };
}

/**
 * The artist opened their invite signed in with the invited email. Solo and
 * group invites become 'accepted': they stay open for the show, the artist is
 * credited, and the organiser hears about it. Returns where to go next.
 */
export async function acceptExhibitionInvite(
  token: string,
): Promise<Result<{ exhibitionId: string; path: string }>> {
  const user = await currentUser();
  if (!user?.email) return { success: false, error: 'Sign in to accept this invitation' };
  if (!token?.trim()) return { success: false, error: 'Invalid invitation link' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: invite } = await admin
    .from('exhibition_artist_invites')
    .select(INVITE_COLUMNS)
    .eq('token_hash', hashClaimToken(token.trim()))
    .maybeSingle();
  if (!invite) return { success: false, error: 'Invalid or expired invitation link' };

  const row = invite as AcceptedInvite;
  // A link-only invite has no email: whoever opens it first and signs in claims it.
  const claimingLink = !row.invitee_email;
  if (row.invitee_email && !emailsMatch(user.email, row.invitee_email)) {
    return {
      success: false,
      error: `Sign in with the email this invite was sent to (${normalizeInviteEmail(row.invitee_email)}).`,
    };
  }

  const path = `/exhibitions/${row.exhibition_id}/artist`;

  if (row.status === 'accepted') {
    if (row.accepted_by && row.accepted_by !== user.id) {
      return { success: false, error: 'This invitation was accepted by another account' };
    }
    return { success: true, exhibitionId: row.exhibition_id, path };
  }
  if (row.status !== 'sent' && row.status !== 'pending') {
    return { success: false, error: 'This invitation is no longer open' };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { success: false, error: 'This invitation has expired; ask the organiser to resend it' };
  }

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, gallery_id, title, show_type')
    .eq('id', row.exhibition_id)
    .maybeSingle();
  if (!exhibition) return { success: false, error: 'Exhibition not found' };
  if (!invitedWorkGoesStraightIn(exhibition.show_type, row.source)) {
    return { success: false, error: 'This invitation is for submitting work only' };
  }

  // Claiming a link writes the artist's email and account onto the invite, so
  // everything after (submissions, reminders) treats it like an email invite.
  const claimFields = claimingLink
    ? { invitee_email: normalizeInviteEmail(user.email), artist_account_id: user.id }
    : {};
  let acceptQuery = admin
    .from('exhibition_artist_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
      ...claimFields,
    })
    .eq('id', row.id)
    .in('status', ['sent', 'pending']);
  if (claimingLink) acceptQuery = acceptQuery.is('invitee_email', null);
  const { data: acceptedRows, error: updateError } = await acceptQuery.select('id');
  if (updateError?.code === '23505') {
    // They already have an invitation to this show under their email.
    const { data: own } = await admin
      .from('exhibition_artist_invites')
      .select('id, status')
      .eq('exhibition_id', row.exhibition_id)
      .eq('accepted_by', user.id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (own) return { success: true, exhibitionId: row.exhibition_id, path };
    return {
      success: false,
      error: 'You already have an invitation to this show; open the one sent to your email',
    };
  }
  if (updateError) {
    console.error('[ExhibitionWorkspace] accept failed', updateError);
    return { success: false, error: 'Could not accept the invitation; try again' };
  }
  if (!acceptedRows?.length) {
    return { success: false, error: 'Someone else already accepted this invitation' };
  }

  const { error: creditError } = await admin.from('exhibition_artists').insert({
    exhibition_id: row.exhibition_id,
    artist_account_id: user.id,
  });
  if (creditError && creditError.code !== '23505') {
    console.error('[ExhibitionWorkspace] artist credit failed', creditError);
  }

  const name = await artistDisplayName(admin, user.id, row);
  await notifyExhibitionOrganisers(admin, {
    exhibition,
    actorUserId: user.id,
    type: 'exhibition_invite_accepted',
    title: `${name} accepted your invitation`,
    message: `${name} accepted your invitation to "${exhibition.title}"${parseShowType(exhibition.show_type) === 'solo' ? ' and can now fill in the show details' : ''}.`,
    email: false,
  });

  revalidatePath(`/exhibitions/${row.exhibition_id}/edit`);
  console.log('[ExhibitionWorkspace] invite accepted', { inviteId: row.id });
  return { success: true, exhibitionId: row.exhibition_id, path };
}

export type ArtistChangeRequest = {
  id: string;
  field: ShowField;
  fieldLabel: string;
  currentValue: string | null;
  proposedValue: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  responseMessage: string | null;
  createdAt: string;
};

export type ArtistWorkspace = {
  exhibitionId: string;
  inviteId: string;
  galleryName: string | null;
  showType: ShowType | null;
  published: boolean;
  canEditShow: boolean;
  values: ShowValues;
  fieldSources: FieldSources;
  plannedPieceCount: number | null;
  notes: string | null;
  maxArtworks: number | null;
  works: Array<{ id: string; title: string; imageUrl: string | null; status: string }>;
  requests: ArtistChangeRequest[];
};

function asText(v: unknown): string | null {
  return typeof v === 'string' ? v : v === null || v === undefined ? null : String(v);
}

export async function getArtistWorkspace(
  exhibitionId: string,
): Promise<{ ok: true; workspace: ArtistWorkspace } | { ok: false; error: string }> {
  const ctx = await loadArtistContext(exhibitionId);
  if (!ctx.ok) return ctx;
  const { admin, invite, exhibition } = ctx;

  const [{ data: gallery }, { data: links }, { data: requests }] = await Promise.all([
    admin.from('accounts').select('name').eq('id', exhibition.gallery_id).maybeSingle(),
    admin
      .from('exhibition_artworks')
      .select('artwork_id, status, created_at')
      .eq('exhibition_id', exhibitionId)
      .eq('submission_invite_id', invite.id)
      .order('created_at', { ascending: true }),
    admin
      .from('exhibition_change_requests')
      .select('id, field, current_value, proposed_value, message, status, response_message, created_at')
      .eq('invite_id', invite.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const linkRows = (links ?? []) as Array<{ artwork_id: string; status: string }>;
  const { data: artworks } = linkRows.length
    ? await admin
        .from('artworks')
        .select('id, title, image_url')
        .in(
          'id',
          linkRows.map((l) => l.artwork_id),
        )
    : { data: [] };
  const byId = new Map(
    ((artworks ?? []) as Array<{ id: string; title: string | null; image_url: string | null }>).map(
      (a) => [a.id, a],
    ),
  );

  return {
    ok: true,
    workspace: {
      exhibitionId,
      inviteId: invite.id,
      galleryName: (gallery?.name as string | null) ?? null,
      showType: parseShowType(exhibition.show_type),
      published: Boolean(exhibition.published_at),
      canEditShow: invite.can_edit_show,
      values: showValues(exhibition),
      fieldSources: parseFieldSources(exhibition.field_sources),
      plannedPieceCount: invite.planned_piece_count,
      notes: invite.artist_notes,
      maxArtworks: invite.max_artworks,
      works: linkRows
        .filter((l) => l.status !== 'declined')
        .map((l) => ({
          id: l.artwork_id,
          title: byId.get(l.artwork_id)?.title?.trim() || 'Untitled',
          imageUrl: byId.get(l.artwork_id)?.image_url ?? null,
          status: l.status,
        })),
      requests: (
        (requests ?? []) as Array<{
          id: string;
          field: string;
          current_value: unknown;
          proposed_value: unknown;
          message: string | null;
          status: ArtistChangeRequest['status'];
          response_message: string | null;
          created_at: string;
        }>
      )
        .filter((r) => isShowField(r.field))
        .map((r) => ({
          id: r.id,
          field: r.field as ShowField,
          fieldLabel: SHOW_FIELD_LABELS[r.field as ShowField],
          currentValue: asText(r.current_value),
          proposedValue: asText(r.proposed_value),
          message: r.message,
          status: r.status,
          responseMessage: r.response_message,
          createdAt: r.created_at,
        })),
    },
  };
}

/** Solo artist fills in or changes show fields the organiser left open. */
export async function updateMyShowDetails(
  exhibitionId: string,
  patch: Partial<Record<ShowField, string | null>>,
): Promise<Result<{ changed: ShowField[] }>> {
  const ctx = await loadArtistContext(exhibitionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { admin, invite, exhibition, userId } = ctx;

  const plan = planArtistShowEdit({
    canEditShow: invite.can_edit_show,
    fieldSources: parseFieldSources(exhibition.field_sources),
    current: showValues(exhibition),
    patch,
  });
  if (!plan.ok) return { success: false, error: plan.error };
  if (plan.changed.length === 0) return { success: true, changed: [] };

  if (containsObjectionableText(plan.updates.title, plan.updates.description, plan.updates.location)) {
    return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const { error } = await admin
    .from('exhibitions')
    .update({
      ...plan.updates,
      field_sources: plan.fieldSources,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exhibitionId);
  if (error) {
    console.error('[ExhibitionWorkspace] update show failed', error);
    return { success: false, error: 'Could not save the show details' };
  }

  const name = await artistDisplayName(admin, userId, invite);
  const fields = plan.changed.map((f) => SHOW_FIELD_LABELS[f].toLowerCase()).join(', ');
  await notifyExhibitionOrganisers(admin, {
    exhibition: { ...exhibition, title: plan.updates.title ?? exhibition.title },
    actorUserId: userId,
    type: 'exhibition_details_updated',
    title: `${name} updated the show details`,
    message: `${name} filled in the ${fields} for "${plan.updates.title ?? exhibition.title}".`,
    email: false,
  });

  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath(`/exhibitions/${exhibitionId}/artist`);
  return { success: true, changed: plan.changed };
}

/** The artist's own part of the show: how many pieces, and notes for the organiser. */
export async function updateMyParticipation(
  exhibitionId: string,
  input: { plannedPieceCount: string | number | null; notes: string | null },
): Promise<Result> {
  const ctx = await loadArtistContext(exhibitionId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const count = parsePlannedPieceCount(input.plannedPieceCount);
  if (count === 'invalid') {
    return { success: false, error: 'Number of pieces must be a whole number from 0 to 1000' };
  }
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 4000) return { success: false, error: 'Notes are too long' };
  if (containsObjectionableText(notes)) return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };

  const { error } = await ctx.admin
    .from('exhibition_artist_invites')
    .update({ planned_piece_count: count, artist_notes: notes })
    .eq('id', ctx.invite.id);
  if (error) {
    console.error('[ExhibitionWorkspace] update participation failed', error);
    return { success: false, error: 'Could not save' };
  }

  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath(`/exhibitions/${exhibitionId}/artist`);
  return { success: true };
}

/**
 * Ask the organiser to change a show field. One open request per field;
 * sending again replaces the proposal.
 */
export async function requestShowChange(
  exhibitionId: string,
  input: { field: string; proposedValue: string | null; message: string | null },
): Promise<Result<{ requestId: string }>> {
  const ctx = await loadArtistContext(exhibitionId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { admin, invite, exhibition, userId } = ctx;

  if (!isShowField(input.field)) return { success: false, error: 'Choose what to change' };
  const field = input.field;
  const normalized = normalizeShowFieldValue(field, input.proposedValue);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const current = showValues(exhibition)[field] ?? null;
  if ((current ?? '') === (normalized.value ?? '')) {
    return { success: false, error: 'That’s already the current value' };
  }
  const message = input.message?.trim() || null;
  if (message && message.length > 2000) return { success: false, error: 'Message is too long' };
  if (containsObjectionableText(normalized.value, message)) {
    return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const row = {
    current_value: current,
    proposed_value: normalized.value,
    message,
  };

  const { data: existing } = await admin
    .from('exhibition_change_requests')
    .select('id')
    .eq('invite_id', invite.id)
    .eq('field', field)
    .eq('status', 'pending')
    .maybeSingle();

  const { data: saved, error } = existing
    ? await admin
        .from('exhibition_change_requests')
        .update(row)
        .eq('id', existing.id)
        .select('id')
        .single()
    : await admin
        .from('exhibition_change_requests')
        .insert({
          ...row,
          exhibition_id: exhibitionId,
          invite_id: invite.id,
          requested_by: userId,
          field,
        })
        .select('id')
        .single();
  if (error || !saved) {
    console.error('[ExhibitionWorkspace] change request save failed', error);
    return { success: false, error: 'Could not send the request' };
  }

  const name = await artistDisplayName(admin, userId, invite);
  const label = SHOW_FIELD_LABELS[field].toLowerCase();
  const proposed = normalized.value
    ? field === 'description'
      ? 'a new description'
      : `"${normalized.value}"`
    : 'leaving it blank';
  await notifyExhibitionOrganisers(admin, {
    exhibition,
    actorUserId: userId,
    type: 'exhibition_change_requested',
    title: `${name} asked to change the ${label}`,
    message: `${name} asked to change the ${label} of "${exhibition.title}" to ${proposed}.${message ? ` Their note: "${message}"` : ''}`,
    email: true,
    emailSubject: `${name} requested a change to "${exhibition.title}"`,
    metadata: { request_id: saved.id, field },
  });

  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath(`/exhibitions/${exhibitionId}/artist`);
  console.log('[ExhibitionWorkspace] change requested', { requestId: saved.id, field });
  return { success: true, requestId: saved.id as string };
}

export async function withdrawShowChangeRequest(
  exhibitionId: string,
  requestId: string,
): Promise<Result> {
  const ctx = await loadArtistContext(exhibitionId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { data, error } = await ctx.admin
    .from('exhibition_change_requests')
    .update({ status: 'withdrawn', responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('invite_id', ctx.invite.id)
    .eq('status', 'pending')
    .select('id');
  if (error || !data?.length) return { success: false, error: 'Could not withdraw that request' };

  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath(`/exhibitions/${exhibitionId}/artist`);
  return { success: true };
}

export type MyInvitedShow = {
  exhibitionId: string;
  title: string;
  startDate: string;
  showType: ShowType | null;
  galleryName: string | null;
};

/** Shows the signed-in artist has accepted invitations to. */
export async function listMyInvitedShows(): Promise<MyInvitedShow[]> {
  const user = await currentUser();
  if (!user) return [];
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: invites } = await admin
    .from('exhibition_artist_invites')
    .select('exhibition_id')
    .eq('accepted_by', user.id)
    .eq('status', 'accepted');
  const ids = [...new Set(((invites ?? []) as { exhibition_id: string }[]).map((i) => i.exhibition_id))];
  if (ids.length === 0) return [];

  const { data: shows } = await admin
    .from('exhibitions')
    .select('id, title, start_date, show_type, gallery_id')
    .in('id', ids)
    .order('start_date', { ascending: false });
  const rows = (shows ?? []) as Array<{
    id: string;
    title: string;
    start_date: string;
    show_type: string | null;
    gallery_id: string;
  }>;
  const { data: galleries } = await admin
    .from('accounts')
    .select('id, name')
    .in('id', [...new Set(rows.map((r) => r.gallery_id))]);
  const galleryName = new Map(
    ((galleries ?? []) as Array<{ id: string; name: string | null }>).map((g) => [g.id, g.name]),
  );

  return rows.map((r) => ({
    exhibitionId: r.id,
    title: r.title,
    startDate: r.start_date,
    showType: parseShowType(r.show_type),
    galleryName: galleryName.get(r.gallery_id) ?? null,
  }));
}

