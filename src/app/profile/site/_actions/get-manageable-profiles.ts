'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { UserRole } from '~/lib/user-roles';

export type ManageableProfile = {
  id: string;
  name: string;
  role: UserRole;
  picture_url: string | null;
  /** How the user has access: their own profile, or a gallery team membership */
  source: 'own' | 'team';
  /** For team profiles, the user's role on the team */
  team_role?: 'owner' | 'admin' | 'member';
};

/**
 * List all profiles the current user can manage a creator-site for:
 *   - profiles they own (user_profiles.user_id = auth.uid())
 *   - gallery profiles where they are a team member (gallery_members)
 *
 * Used to power the profile selector at /profile/site.
 */
export async function getManageableProfiles(): Promise<ManageableProfile[]> {
  console.log('[Sites] getManageableProfiles');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const sb = client as any;

  // 1. Own profiles
  const { data: ownProfiles, error: ownErr } = await sb
    .from('user_profiles')
    .select('id, name, role, picture_url')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (ownErr) {
    console.error('[Sites] getManageableProfiles own profiles failed', ownErr);
  }

  const result: ManageableProfile[] = (ownProfiles ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role as UserRole,
    picture_url: p.picture_url ?? null,
    source: 'own' as const,
  }));

  // 2. Gallery team memberships
  const { data: memberships, error: memErr } = await sb
    .from('gallery_members')
    .select('gallery_profile_id, role')
    .eq('user_id', user.id);

  if (memErr) {
    console.error('[Sites] getManageableProfiles memberships failed', memErr);
  }

  const teamProfileIds = (memberships ?? []).map((m: any) => m.gallery_profile_id);
  const teamRoleByProfileId = new Map<string, 'owner' | 'admin' | 'member'>();
  for (const m of memberships ?? []) {
    teamRoleByProfileId.set(m.gallery_profile_id, m.role);
  }

  if (teamProfileIds.length > 0) {
    const { data: teamProfiles } = await sb
      .from('user_profiles')
      .select('id, name, role, picture_url')
      .in('id', teamProfileIds)
      .eq('is_active', true);

    const ownIds = new Set(result.map((r) => r.id));
    for (const p of teamProfiles ?? []) {
      if (ownIds.has(p.id)) continue; // dedupe — owner is also a member
      result.push({
        id: p.id,
        name: p.name,
        role: p.role as UserRole,
        picture_url: p.picture_url ?? null,
        source: 'team',
        team_role: teamRoleByProfileId.get(p.id),
      });
    }
  }

  console.log('[Sites] getManageableProfiles resolved', { count: result.length });
  return result;
}
