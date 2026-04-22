'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';

export type CrmMember = {
  member_user_id: string;
  invited_by: string | null;
  created_at: string;
  email: string | null;
  name: string | null;
};

// ─── Resolve whose CRM the current user should see ───────────────────────────

/**
 * Returns the artist_user_id for the CRM the current user should access.
 * - If the user has their own artist profile → their own id (isOwner: true).
 * - If they are a crm_member for another artist → that artist's id (isOwner: false).
 * - Returns null if not eligible for CRM access at all.
 */
export async function getCrmOwnerContext(): Promise<{
  ownerUserId: string;
  isOwner: boolean;
} | null> {
  console.log('[CrmMembers] getCrmOwnerContext started');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  // Check if user has their own artist profile
  const { data: artistProfile } = await (client as any)
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'artist')
    .maybeSingle();

  if (artistProfile) {
    return { ownerUserId: user.id, isOwner: true };
  }

  // Check for CRM membership
  const { data: membership } = await (client as any)
    .from('crm_members')
    .select('artist_user_id')
    .eq('member_user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.artist_user_id) {
    console.log('[CrmMembers] getCrmOwnerContext: user is team member of', membership.artist_user_id);
    return { ownerUserId: membership.artist_user_id, isOwner: false };
  }

  return null;
}

// ─── List members (owner only) ───────────────────────────────────────────────

export async function getCrmMembers(): Promise<CrmMember[]> {
  console.log('[CrmMembers] getCrmMembers started');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await (client as any)
    .from('crm_members')
    .select('member_user_id, invited_by, created_at')
    .eq('artist_user_id', user.id)
    .order('created_at');

  if (error || !data?.length) {
    if (error) console.error('[CrmMembers] getCrmMembers failed', error);
    return [];
  }

  // Enrich with email/name from accounts via service-role client
  const admin = getSupabaseServerAdminClient();
  const memberIds: string[] = data.map((m: any) => m.member_user_id);

  const { data: accounts, error: accErr } = await (admin as any)
    .from('accounts')
    .select('id, email, name')
    .in('id', memberIds);

  if (accErr) console.error('[CrmMembers] enrichment failed', accErr);

  const accountMap = new Map<string, { email: string | null; name: string | null }>(
    (accounts ?? []).map((a: any) => [a.id, { email: a.email, name: a.name }]),
  );

  const members: CrmMember[] = data.map((m: any) => ({
    member_user_id: m.member_user_id,
    invited_by:     m.invited_by,
    created_at:     m.created_at,
    email:          accountMap.get(m.member_user_id)?.email ?? null,
    name:           accountMap.get(m.member_user_id)?.name  ?? null,
  }));

  console.log('[CrmMembers] getCrmMembers success', members.length, 'members');
  return members;
}

// ─── Invite a member by email ────────────────────────────────────────────────

export async function inviteCrmMemberByEmail(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  console.log('[CrmMembers] inviteCrmMemberByEmail', trimmed);

  if (!trimmed) return { success: false, error: 'Email is required.' };

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'You must be logged in.' };

  // Verify caller is an artist (owner)
  const { data: artistProfile } = await (client as any)
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'artist')
    .maybeSingle();

  if (!artistProfile) {
    return { success: false, error: 'Only artists can manage CRM access.' };
  }

  // Look up the invited user by exact email via admin client
  const admin = getSupabaseServerAdminClient();
  const { data: accounts, error: lookupErr } = await (admin as any)
    .from('accounts')
    .select('id, email')
    .eq('email', trimmed)
    .limit(1);

  if (lookupErr) {
    console.error('[CrmMembers] email lookup failed', lookupErr);
    return { success: false, error: 'Failed to look up user.' };
  }

  const found = accounts?.[0];
  if (!found) {
    return {
      success: false,
      error: 'No Provenance account found with that email.',
    };
  }

  if (found.id === user.id) {
    return { success: false, error: 'You cannot add yourself as a team member.' };
  }

  const { error: insertErr } = await (client as any).from('crm_members').insert({
    artist_user_id: user.id,
    member_user_id: found.id,
    invited_by:     user.id,
  });

  if (insertErr) {
    console.error('[CrmMembers] insert failed', insertErr);
    if (insertErr.code === '23505') {
      return { success: false, error: 'This person already has access.' };
    }
    return { success: false, error: insertErr.message };
  }

  console.log('[CrmMembers] inviteCrmMemberByEmail success');
  revalidatePath('/portal/or');
  return { success: true };
}

// ─── Column label customisation ──────────────────────────────────────────────

export type ColumnLabels = Partial<Record<string, string>>;

/**
 * Returns saved column label overrides for the current CRM context.
 * Falls back to an empty object — callers merge with STAGE_LABELS defaults.
 */
export async function getCrmColumnLabels(): Promise<ColumnLabels> {
  console.log('[CrmMembers] getCrmColumnLabels started');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return {};

  const ctx = await getCrmOwnerContext();
  if (!ctx) return {};

  const { data, error } = await (client as any)
    .from('crm_settings')
    .select('column_labels')
    .eq('artist_user_id', ctx.ownerUserId)
    .maybeSingle();

  if (error) console.error('[CrmMembers] getCrmColumnLabels failed', error);
  return (data?.column_labels as ColumnLabels) ?? {};
}

/**
 * Saves a custom label for a single stage column. Owner only.
 * Pass an empty string to reset a stage back to its default.
 */
export async function updateCrmColumnLabel(
  stage: string,
  label: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[CrmMembers] updateCrmColumnLabel', stage, label);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'You must be logged in.' };

  // Only the artist owner may rename columns
  const { data: artistProfile } = await (client as any)
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'artist')
    .maybeSingle();

  if (!artistProfile) return { success: false, error: 'Only artists can rename columns.' };

  const trimmed = label.trim();

  // Read current labels, merge in the change, then upsert — preserves other custom labels
  const { data: existing } = await (client as any)
    .from('crm_settings')
    .select('column_labels')
    .eq('artist_user_id', user.id)
    .maybeSingle();

  const currentLabels = (existing?.column_labels as ColumnLabels) ?? {};
  const merged: ColumnLabels = { ...currentLabels };
  if (trimmed) {
    merged[stage] = trimmed;
  } else {
    delete merged[stage];
  }

  const { error } = await (client as any).from('crm_settings').upsert({
    artist_user_id: user.id,
    column_labels: merged,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[CrmMembers] updateCrmColumnLabel failed', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/portal/or');
  return { success: true };
}

// ─── Remove a member ─────────────────────────────────────────────────────────

export async function removeCrmMember(
  memberUserId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[CrmMembers] removeCrmMember', memberUserId);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'You must be logged in.' };

  const { error } = await (client as any)
    .from('crm_members')
    .delete()
    .eq('artist_user_id', user.id)
    .eq('member_user_id', memberUserId);

  if (error) {
    console.error('[CrmMembers] removeCrmMember failed', error);
    return { success: false, error: error.message };
  }

  console.log('[CrmMembers] removeCrmMember success');
  revalidatePath('/portal/or');
  return { success: true };
}
