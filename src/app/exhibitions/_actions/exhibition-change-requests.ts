'use server';

import { revalidatePath } from 'next/cache';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import { requireExhibitionManager } from '../_helpers/require-exhibition-manager';
import { notifyArtistOfChangeResponse } from '../_helpers/notify-exhibition-organisers';
import {
  isShowField,
  parseFieldSources,
  planApprovedChange,
  SHOW_FIELD_LABELS,
  type ShowField,
} from '../_helpers/show-collaboration';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

export type OrganiserChangeRequest = {
  id: string;
  artistName: string;
  field: ShowField;
  fieldLabel: string;
  currentValue: string | null;
  proposedValue: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  responseMessage: string | null;
  createdAt: string;
};

function asText(v: unknown): string | null {
  return typeof v === 'string' ? v : v === null || v === undefined ? null : String(v);
}

/** Change requests from invited artists (pending first), for the edit page. */
export async function getExhibitionChangeRequests(
  exhibitionId: string,
): Promise<OrganiserChangeRequest[]> {
  const managed = await requireExhibitionManager(exhibitionId);
  if (!managed.ok) return [];
  const { admin } = managed.ctx;

  const { data, error } = await admin
    .from('exhibition_change_requests')
    .select(
      'id, invite_id, field, current_value, proposed_value, message, status, response_message, created_at',
    )
    .eq('exhibition_id', exhibitionId)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[ExhibitionChangeRequests] load failed', error);
    return [];
  }

  type Row = {
    id: string;
    invite_id: string;
    field: string;
    current_value: unknown;
    proposed_value: unknown;
    message: string | null;
    status: OrganiserChangeRequest['status'];
    response_message: string | null;
    created_at: string;
  };
  const rows = ((data ?? []) as Row[]).filter((r) => isShowField(r.field));
  const names = await inviteArtistNames(
    admin,
    [...new Set(rows.map((r) => r.invite_id))],
  );

  return rows
    .map((r) => ({
      id: r.id,
      artistName: names.get(r.invite_id) ?? 'Artist',
      field: r.field as ShowField,
      fieldLabel: SHOW_FIELD_LABELS[r.field as ShowField],
      currentValue: asText(r.current_value),
      proposedValue: asText(r.proposed_value),
      message: r.message,
      status: r.status,
      responseMessage: r.response_message,
      createdAt: r.created_at,
    }))
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
}

async function inviteArtistNames(
  admin: Parameters<typeof notifyArtistOfChangeResponse>[0],
  inviteIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (inviteIds.length === 0) return out;
  const { data: invites } = await admin
    .from('exhibition_artist_invites')
    .select('id, invitee_name, invitee_email, accepted_by')
    .in('id', inviteIds);
  const rows = (invites ?? []) as Array<{
    id: string;
    invitee_name: string | null;
    invitee_email: string;
    accepted_by: string | null;
  }>;
  const accountIds = rows.map((r) => r.accepted_by).filter((id): id is string => !!id);
  const { data: accounts } = accountIds.length
    ? await admin.from('accounts').select('id, name').in('id', accountIds)
    : { data: [] };
  const accountName = new Map(
    ((accounts ?? []) as Array<{ id: string; name: string | null }>).map((a) => [a.id, a.name]),
  );
  for (const r of rows) {
    out.set(
      r.id,
      (r.accepted_by && accountName.get(r.accepted_by)?.trim()) ||
        r.invitee_name?.trim() ||
        r.invitee_email,
    );
  }
  return out;
}

/**
 * Approve (apply the proposed value) or decline (with an optional reply) an
 * artist's change request. Either way the artist is told.
 */
export async function respondToChangeRequest(
  exhibitionId: string,
  requestId: string,
  decision: 'approve' | 'decline',
  responseMessage?: string | null,
): Promise<Result> {
  const managed = await requireExhibitionManager(exhibitionId);
  if (!managed.ok) return { success: false, error: managed.error };
  const { admin, userId } = managed.ctx;

  const reply = responseMessage?.trim() || null;
  if (reply && reply.length > 2000) return { success: false, error: 'Reply is too long' };
  if (containsObjectionableText(reply)) return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };

  const { data: request } = await admin
    .from('exhibition_change_requests')
    .select('id, field, proposed_value, status, requested_by')
    .eq('id', requestId)
    .eq('exhibition_id', exhibitionId)
    .maybeSingle();
  if (!request) return { success: false, error: 'Request not found' };
  if (request.status !== 'pending') return { success: false, error: 'This request was already answered' };
  if (!isShowField(request.field)) return { success: false, error: 'Unknown field' };
  const field = request.field as ShowField;

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, title, start_date, end_date, field_sources')
    .eq('id', exhibitionId)
    .single();
  if (!exhibition) return { success: false, error: 'Exhibition not found' };

  let appliedTitle = exhibition.title as string;
  if (decision === 'approve') {
    const plan = planApprovedChange({
      field,
      proposed: request.proposed_value,
      current: { start_date: exhibition.start_date, end_date: exhibition.end_date },
      fieldSources: parseFieldSources(exhibition.field_sources),
    });
    if (!plan.ok) return { success: false, error: plan.error };

    const { error: applyError } = await admin
      .from('exhibitions')
      .update({
        ...plan.updates,
        field_sources: plan.fieldSources,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exhibitionId);
    if (applyError) {
      console.error('[ExhibitionChangeRequests] apply failed', applyError);
      return { success: false, error: 'Could not apply the change' };
    }
    if (plan.updates.title) appliedTitle = plan.updates.title;
  }

  const { error: updateError } = await admin
    .from('exhibition_change_requests')
    .update({
      status: decision === 'approve' ? 'approved' : 'declined',
      response_message: reply,
      responded_by: userId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending');
  if (updateError) {
    console.error('[ExhibitionChangeRequests] status update failed', updateError);
    return { success: false, error: 'Could not save your answer' };
  }

  const label = SHOW_FIELD_LABELS[field].toLowerCase();
  await notifyArtistOfChangeResponse(admin, {
    artistUserId: request.requested_by as string,
    actorUserId: userId,
    exhibitionId,
    title:
      decision === 'approve'
        ? `Your ${label} change was approved`
        : `Your ${label} change was declined`,
    message:
      decision === 'approve'
        ? `The organiser approved your change to the ${label} of "${appliedTitle}".${reply ? ` Their note: "${reply}"` : ''}`
        : `The organiser kept the current ${label} of "${appliedTitle}".${reply ? ` Their note: "${reply}"` : ''}`,
  });

  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  revalidatePath(`/exhibitions/${exhibitionId}/artist`);
  console.log('[ExhibitionChangeRequests] answered', { requestId, decision });
  return { success: true };
}
