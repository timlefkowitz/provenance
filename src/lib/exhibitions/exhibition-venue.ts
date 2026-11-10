import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { asUntyped } from '~/lib/supabase-untyped';
import { TEAM_PROFILE_ROLES, USER_ROLES } from '~/lib/user-roles';

/** A gallery or institution a show can be held at. */
export type VenueGallery = {
  id: string;
  name: string;
  role: string;
  /** The account that owns the gallery profile. */
  userId: string;
};

/**
 * Galleries this user can put a show at: active gallery / institution
 * profiles they own, plus ones they are on the team of.
 */
export async function listVenueGalleriesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<VenueGallery[]> {
  const db = asUntyped(client);

  const { data: owned } = await db
    .from('user_profiles')
    .select('id, name, role, user_id, created_at')
    .eq('user_id', userId)
    .in('role', [...TEAM_PROFILE_ROLES])
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const { data: memberships } = await db
    .from('gallery_members')
    .select('gallery_profile_id')
    .eq('user_id', userId);
  const memberIds = ((memberships ?? []) as { gallery_profile_id: string | null }[])
    .map((m) => m.gallery_profile_id)
    .filter((id): id is string => !!id);

  const { data: teamProfiles } = memberIds.length
    ? await db
        .from('user_profiles')
        .select('id, name, role, user_id, created_at')
        .in('id', memberIds)
        .in('role', [...TEAM_PROFILE_ROLES])
        .eq('is_active', true)
    : { data: [] };

  const seen = new Set<string>();
  const out: VenueGallery[] = [];
  for (const p of [...(owned ?? []), ...(teamProfiles ?? [])] as Record<string, unknown>[]) {
    const id = p.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: (p.name as string) ?? 'Gallery',
      role: p.role as string,
      userId: p.user_id as string,
    });
  }
  return out;
}

/** Whether this user may put a show at the given gallery profile. */
export async function canUseVenueGallery(
  client: SupabaseClient,
  userId: string,
  galleryProfileId: string,
): Promise<boolean> {
  const venues = await listVenueGalleriesForUser(client, userId);
  return venues.some((v) => v.id === galleryProfileId);
}

/**
 * The account's default gallery profile: its earliest active gallery (or
 * institution) profile. Shows without an explicit venue belong to it.
 */
export async function loadDefaultTeamProfileId(
  client: SupabaseClient,
  accountId: string,
  role: string = USER_ROLES.GALLERY,
): Promise<string | null> {
  const { data } = await asUntyped(client)
    .from('user_profiles')
    .select('id')
    .eq('user_id', accountId)
    .eq('role', role)
    .eq('is_active', true)
    // Galleries can have several active profiles; maybeSingle() alone errors on that.
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
