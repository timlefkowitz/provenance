'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { requireAdminUserId } from '~/lib/admin';
import { sendNotificationEmail } from '~/lib/email';
import { getPublicSiteUrlForEmail } from '~/lib/email-layout';
import {
  formatTrialLength,
  getInstitutionInviteStatus,
  institutionInvitePath,
  isAllowedTrialDays,
  MAX_INVITES_PER_SEND,
  parseInviteEmails,
  type InstitutionInviteStatus,
  type InstitutionTeamRole,
} from '~/lib/institutions/institution-invites';
import { asUntyped } from '~/lib/supabase-untyped';
import { USER_ROLES } from '~/lib/user-roles';

const ADMIN_PATH = '/admin/institutions';

export type InstitutionOption = {
  id: string;
  name: string;
  hasOwner: boolean;
  teamSize: number;
};

export type AdminInstitutionInvite = {
  id: string;
  institutionProfileId: string;
  institutionName: string;
  email: string;
  teamRole: InstitutionTeamRole;
  trialDays: number;
  status: InstitutionInviteStatus;
  sentAt: string | null;
  sendCount: number;
  lastSendError: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

type InviteRow = {
  id: string;
  token: string;
  institution_profile_id: string;
  email: string;
  team_role: InstitutionTeamRole;
  trial_days: number;
  note: string | null;
  sent_at: string | null;
  send_count: number;
  last_send_error: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type ListRow = Omit<InviteRow, 'token' | 'note'>;

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function newInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Institution profiles an admin can invite a team to. */
export async function listInstitutionOptions(): Promise<Result<{ institutions: InstitutionOption[] }>> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: profiles, error } = await admin
    .from('user_profiles')
    .select('id, name, user_id')
    .eq('role', USER_ROLES.INSTITUTION)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[InstitutionInvites] listInstitutionOptions failed', error);
    return { ok: false, error: error.message };
  }

  const ids = (profiles ?? []).map((p: { id: string }) => p.id);
  const teamSizes = new Map<string, number>();
  if (ids.length) {
    const { data: members } = await admin
      .from('gallery_members')
      .select('gallery_profile_id')
      .in('gallery_profile_id', ids);
    for (const m of (members ?? []) as Array<{ gallery_profile_id: string }>) {
      teamSizes.set(m.gallery_profile_id, (teamSizes.get(m.gallery_profile_id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    institutions: (profiles ?? []).map((p: { id: string; name: string | null; user_id: string | null }) => ({
      id: p.id,
      name: p.name || 'Untitled institution',
      hasOwner: Boolean(p.user_id),
      teamSize: teamSizes.get(p.id) ?? 0,
    })),
  };
}

/** Every invite, newest first, with its institution's name. */
export async function listInstitutionInvites(): Promise<Result<{ invites: AdminInstitutionInvite[] }>> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: rows, error } = await admin
    .from('institution_invites')
    .select(
      'id, institution_profile_id, email, team_role, trial_days, sent_at, send_count, last_send_error, accepted_at, revoked_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[InstitutionInvites] listInstitutionInvites failed', error);
    return { ok: false, error: error.message };
  }

  const profileIds = Array.from(
    new Set((rows ?? []).map((r: ListRow) => r.institution_profile_id)),
  );
  const names = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, name')
      .in('id', profileIds);
    for (const p of (profiles ?? []) as Array<{ id: string; name: string | null }>) {
      names.set(p.id, p.name || 'Untitled institution');
    }
  }

  return {
    ok: true,
    invites: (rows ?? []).map((r: ListRow) => ({
      id: r.id,
      institutionProfileId: r.institution_profile_id,
      institutionName: names.get(r.institution_profile_id) ?? 'Unknown institution',
      email: r.email,
      teamRole: r.team_role,
      trialDays: r.trial_days,
      status: getInstitutionInviteStatus(r),
      sentAt: r.sent_at,
      sendCount: r.send_count,
      lastSendError: r.last_send_error,
      acceptedAt: r.accepted_at,
      createdAt: r.created_at,
    })),
  };
}

async function deliverInvite(
  invite: Pick<InviteRow, 'id' | 'token' | 'email' | 'trial_days' | 'note' | 'team_role' | 'send_count'>,
  institutionName: string,
): Promise<string | null> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const url = `${getPublicSiteUrlForEmail()}${institutionInvitePath(invite.token)}`;
  const trial = formatTrialLength(invite.trial_days);
  const note = invite.note?.trim();

  const body = [
    `You've been invited to join ${institutionName} on Provenance, with ${trial} free for your whole team.`,
    note || null,
    `Provenance keeps your collection, exhibitions, loans and certificates in one place, with a verified provenance record for every work. It works on the web and in the Provenance iPhone app.`,
    `Accept with this email address (${invite.email}). The link is yours alone; each colleague gets their own.`,
  ]
    .filter(Boolean)
    .join('\n');

  let sendError: string | null = null;
  try {
    await sendNotificationEmail(
      invite.email,
      invite.email.split('@')[0] || 'there',
      `Join ${institutionName} on Provenance — ${trial} free`,
      {
        title: `Join ${institutionName} on Provenance`,
        body,
        ctaUrl: url,
        ctaLabel: 'Accept invitation',
      },
      { strict: true },
    );
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'Failed to send email';
    console.error('[InstitutionInvites] send failed', { inviteId: invite.id, sendError });
  }

  await admin
    .from('institution_invites')
    .update({
      sent_at: sendError ? undefined : new Date().toISOString(),
      send_count: invite.send_count + (sendError ? 0 : 1),
      last_send_error: sendError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  return sendError;
}

export type SendInstitutionInvitesInput = {
  /** Existing institution profile, or null to create one from `newInstitutionName`. */
  institutionProfileId: string | null;
  newInstitutionName?: string;
  emails: string;
  teamRole: InstitutionTeamRole;
  trialDays: number;
  note?: string;
};

export type SendInviteOutcome = {
  email: string;
  result: 'sent' | 'already_invited' | 'failed';
  error?: string;
};

/**
 * Creates one invite per email for an institution and sends each its own link.
 * Creates the institution profile first when the admin typed a new name; the
 * first person to accept becomes its owner.
 */
export async function sendInstitutionInvites(
  input: SendInstitutionInvitesInput,
): Promise<Result<{ institutionProfileId: string; outcomes: SendInviteOutcome[]; invalid: string[] }>> {
  console.log('[InstitutionInvites] sendInstitutionInvites started', {
    institutionProfileId: input.institutionProfileId,
    hasNewName: Boolean(input.newInstitutionName),
    teamRole: input.teamRole,
    trialDays: input.trialDays,
  });

  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  if (input.teamRole !== 'admin' && input.teamRole !== 'member') {
    return { ok: false, error: 'Invalid team role' };
  }
  if (!isAllowedTrialDays(input.trialDays)) {
    return { ok: false, error: 'Invalid trial length' };
  }

  const { valid, invalid } = parseInviteEmails(input.emails);
  if (!valid.length) {
    return { ok: false, error: invalid.length ? `No valid emails (couldn't read: ${invalid.join(', ')})` : 'Add at least one email' };
  }
  if (valid.length > MAX_INVITES_PER_SEND) {
    return { ok: false, error: `Send at most ${MAX_INVITES_PER_SEND} invites at a time` };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());

  // Resolve or create the institution profile.
  let profileId = input.institutionProfileId;
  let institutionName: string;
  if (profileId) {
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', profileId)
      .maybeSingle();
    if (!profile || profile.role !== USER_ROLES.INSTITUTION) {
      return { ok: false, error: 'Institution not found' };
    }
    institutionName = profile.name || 'your institution';
  } else {
    const name = input.newInstitutionName?.trim();
    if (!name) return { ok: false, error: 'Choose an institution or enter a new name' };
    const { data: created, error: createError } = await admin
      .from('user_profiles')
      .insert({
        user_id: null,
        role: USER_ROLES.INSTITUTION,
        name,
        is_claimed: false,
        is_active: true,
      })
      .select('id, name')
      .single();
    if (createError || !created) {
      console.error('[InstitutionInvites] create institution failed', createError);
      return { ok: false, error: createError?.message || 'Could not create institution' };
    }
    profileId = created.id as string;
    institutionName = created.name as string;
    console.log('[InstitutionInvites] created institution profile', { profileId });
  }

  const outcomes: SendInviteOutcome[] = [];
  const note = input.note?.trim() || null;

  for (const email of valid) {
    const { data: existing } = await admin
      .from('institution_invites')
      .select('id')
      .eq('institution_profile_id', profileId)
      .eq('email', email)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .maybeSingle();

    if (existing) {
      outcomes.push({ email, result: 'already_invited' });
      continue;
    }

    const { data: invite, error: insertError } = await admin
      .from('institution_invites')
      .insert({
        token: newInviteToken(),
        institution_profile_id: profileId,
        email,
        team_role: input.teamRole,
        trial_days: input.trialDays,
        note,
        invited_by: adminId,
      })
      .select('id, token, email, trial_days, note, team_role, send_count')
      .single();

    if (insertError || !invite) {
      console.error('[InstitutionInvites] insert failed', { email, insertError });
      outcomes.push({ email, result: 'failed', error: insertError?.message || 'Could not save invite' });
      continue;
    }

    const sendError = await deliverInvite(invite as InviteRow, institutionName);
    outcomes.push(sendError ? { email, result: 'failed', error: sendError } : { email, result: 'sent' });
  }

  console.log('[InstitutionInvites] sendInstitutionInvites completed', {
    profileId,
    sent: outcomes.filter((o) => o.result === 'sent').length,
    failed: outcomes.filter((o) => o.result === 'failed').length,
    skipped: outcomes.filter((o) => o.result === 'already_invited').length,
  });

  revalidatePath(ADMIN_PATH);
  return { ok: true, institutionProfileId: profileId!, outcomes, invalid };
}

/** Sends a pending invite's email again (same link). */
export async function resendInstitutionInvite(inviteId: string): Promise<Result<object>> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: invite } = await admin
    .from('institution_invites')
    .select('id, token, email, trial_days, note, team_role, send_count, accepted_at, revoked_at, institution_profile_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite) return { ok: false, error: 'Invite not found' };
  if (getInstitutionInviteStatus(invite) !== 'pending') {
    return { ok: false, error: 'Only pending invites can be resent' };
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('name')
    .eq('id', invite.institution_profile_id)
    .maybeSingle();

  const sendError = await deliverInvite(invite as InviteRow, profile?.name || 'your institution');
  revalidatePath(ADMIN_PATH);
  return sendError ? { ok: false, error: sendError } : { ok: true };
}

/** Cancels a pending invite so its link stops working. */
export async function revokeInstitutionInvite(inviteId: string): Promise<Result<object>> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { error } = await admin
    .from('institution_invites')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', inviteId)
    .is('accepted_at', null);

  if (error) {
    console.error('[InstitutionInvites] revoke failed', error);
    return { ok: false, error: error.message };
  }

  console.log('[InstitutionInvites] revoked', { inviteId });
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
