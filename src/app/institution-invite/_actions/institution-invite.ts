'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { INSTITUTION_ACCOUNT_TYPE } from '~/lib/institution-account';
import {
  getInstitutionInviteStatus,
  institutionTrialEnd,
  institutionTrialSubscriptionId,
  shouldLockAccountToInstitution,
  type InstitutionInviteStatus,
  type InstitutionTeamRole,
} from '~/lib/institutions/institution-invites';
import { createNotification } from '~/lib/notifications';
import { asUntyped } from '~/lib/supabase-untyped';
import { USER_ROLES } from '~/lib/user-roles';

type InviteRow = {
  id: string;
  institution_profile_id: string;
  email: string;
  team_role: InstitutionTeamRole;
  trial_days: number;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
};

export type InstitutionInvitePreview = {
  institutionName: string;
  institutionPictureUrl: string | null;
  email: string;
  trialDays: number;
  teamRole: InstitutionTeamRole;
  status: InstitutionInviteStatus;
};

async function loadInvite(token: string) {
  if (!token || token.length > 200) return null;
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: invite } = await admin
    .from('institution_invites')
    .select(
      'id, institution_profile_id, email, team_role, trial_days, accepted_at, accepted_by, revoked_at',
    )
    .eq('token', token)
    .maybeSingle();
  if (!invite) return null;

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, name, user_id, picture_url')
    .eq('id', invite.institution_profile_id)
    .maybeSingle();
  if (!profile) return null;

  return {
    invite: invite as InviteRow,
    profile: profile as { id: string; name: string | null; user_id: string | null; picture_url: string | null },
  };
}

/** What the invite page shows before someone signs in. Token holders only. */
export async function getInstitutionInvitePreview(
  token: string,
): Promise<InstitutionInvitePreview | null> {
  const loaded = await loadInvite(token);
  if (!loaded) return null;
  return {
    institutionName: loaded.profile.name || 'An institution',
    institutionPictureUrl: loaded.profile.picture_url,
    email: loaded.invite.email,
    trialDays: loaded.invite.trial_days,
    teamRole: loaded.invite.team_role,
    status: getInstitutionInviteStatus(loaded.invite),
  };
}

export type AcceptInstitutionInviteResult =
  | { ok: true; redirectTo: string; becameOwner: boolean }
  | { ok: false; error: string };

/**
 * Accepts an invite for the signed-in user: joins the institution team,
 * grants the trial, and locks a fresh account to institution mode.
 * Safe to retry; each step skips work that's already done.
 */
export async function acceptInstitutionInvite(token: string): Promise<AcceptInstitutionInviteResult> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to accept this invitation.' };

  console.log('[InstitutionInvites] accept started', { userId: user.id });

  const loaded = await loadInvite(token);
  if (!loaded) return { ok: false, error: 'This invitation link is not valid.' };
  const { invite, profile } = loaded;
  const status = getInstitutionInviteStatus(invite);

  if (status === 'revoked') {
    return { ok: false, error: 'This invitation was cancelled. Ask your Provenance contact for a new one.' };
  }
  if (status === 'accepted' && invite.accepted_by !== user.id) {
    return { ok: false, error: 'This invitation has already been used.' };
  }

  const userEmail = (user.email || '').toLowerCase();
  if (userEmail !== invite.email.toLowerCase()) {
    console.warn('[InstitutionInvites] accept email mismatch', { userId: user.id, inviteId: invite.id });
    return {
      ok: false,
      error: `This invitation is for ${invite.email}, but you're signed in as ${user.email || 'another account'}. Sign out and sign in with ${invite.email}.`,
    };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Team. The first person to accept for an institution with no owner owns it.
  let becameOwner = false;
  if (!profile.user_id) {
    const { data: claimed } = await admin
      .from('user_profiles')
      .update({ user_id: user.id, is_claimed: true })
      .eq('id', profile.id)
      .is('user_id', null)
      .select('id');
    becameOwner = (claimed?.length ?? 0) > 0;
  }
  const ownerUserId = becameOwner ? user.id : profile.user_id;

  const { data: existingMember } = await admin
    .from('gallery_members')
    .select('id, role')
    .eq('gallery_profile_id', profile.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const teamRole = becameOwner ? 'owner' : invite.team_role;
  if (!existingMember) {
    const { error: memberError } = await admin.from('gallery_members').insert({
      gallery_profile_id: profile.id,
      user_id: user.id,
      role: teamRole,
      invited_at: nowIso,
      joined_at: nowIso,
    });
    if (memberError) {
      console.error('[InstitutionInvites] team insert failed', memberError);
      return { ok: false, error: 'Could not add you to the team. Please try again.' };
    }
  } else if (becameOwner && existingMember.role !== 'owner') {
    await admin.from('gallery_members').update({ role: 'owner' }).eq('id', existingMember.id);
  }

  // 2. Trial (one per invite).
  const subscriptionId = institutionTrialSubscriptionId(invite.id);
  const { data: existingTrial } = await admin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!existingTrial) {
    const trialEndIso = institutionTrialEnd(now, invite.trial_days).toISOString();
    const { error: trialError } = await admin.from('subscriptions').insert({
      user_id: user.id,
      stripe_customer_id: null,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: null,
      status: 'trialing',
      current_period_end: trialEndIso,
      trial_end: trialEndIso,
      role: USER_ROLES.INSTITUTION,
      updated_at: nowIso,
    });
    if (trialError) {
      // Don't block joining the team; an admin can grant access by hand.
      console.error('[InstitutionInvites] trial insert failed', trialError);
    }
  }

  // 3. Mode. Lock accounts with nothing else on them; otherwise just switch to institution mode.
  const [{ data: account }, { data: ownedProfiles }] = await Promise.all([
    admin.from('accounts').select('public_data').eq('id', user.id).maybeSingle(),
    admin.from('user_profiles').select('role').eq('user_id', user.id).eq('is_active', true),
  ]);
  const publicData = { ...((account?.public_data as Record<string, unknown>) || {}) };
  const lock = shouldLockAccountToInstitution(
    ((ownedProfiles ?? []) as Array<{ role: string }>).map((p) => p.role),
  );
  if (lock) publicData.account_type = INSTITUTION_ACCOUNT_TYPE;
  publicData.role = USER_ROLES.INSTITUTION;
  const { error: accountError } = await admin
    .from('accounts')
    .update({ public_data: publicData })
    .eq('id', user.id);
  if (accountError) {
    console.error('[InstitutionInvites] account mode update failed', accountError);
  }

  // 4. Mark the invite used.
  if (status === 'pending') {
    await admin
      .from('institution_invites')
      .update({ accepted_at: nowIso, accepted_by: user.id, updated_at: nowIso })
      .eq('id', invite.id)
      .is('accepted_at', null);
  }

  // 5. Let the owner know someone joined.
  if (ownerUserId && ownerUserId !== user.id) {
    try {
      await createNotification({
        userId: ownerUserId,
        type: 'gallery_team_invite',
        title: `${user.email} joined ${profile.name || 'your institution'}`,
        message: `${user.email} accepted their invitation and joined the team as ${teamRole}.`,
        metadata: { galleryProfileId: profile.id, role: teamRole, galleryName: profile.name, profileRole: 'institution' },
      });
    } catch (err) {
      console.error('[InstitutionInvites] owner notification failed', err);
    }
  }

  console.log('[InstitutionInvites] accept completed', {
    userId: user.id,
    inviteId: invite.id,
    becameOwner,
    locked: lock,
  });

  revalidatePath('/', 'layout');
  return {
    ok: true,
    becameOwner,
    redirectTo: becameOwner ? `/profiles/${profile.id}/edit` : '/exhibitions',
  };
}
