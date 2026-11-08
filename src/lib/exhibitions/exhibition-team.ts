import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { asUntyped } from '~/lib/supabase-untyped';
import { TEAM_PROFILE_ROLES } from '~/lib/user-roles';

/**
 * Everyone who runs an exhibition: the owning account (exhibitions.gallery_id)
 * plus every team member of that account's gallery / institution profiles —
 * the same people canManageExhibition lets in. Service role, because visitors
 * (often signed out) trigger the notifications that use this.
 */
export async function getExhibitionTeamUserIds(
  adminClient: SupabaseClient,
  galleryId: string,
): Promise<string[]> {
  const admin = asUntyped(adminClient);
  const ids = new Set<string>([galleryId]);

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id')
    .eq('user_id', galleryId)
    .in('role', [...TEAM_PROFILE_ROLES]);
  const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);

  if (profileIds.length > 0) {
    const { data: members } = await admin
      .from('gallery_members')
      .select('user_id')
      .in('gallery_profile_id', profileIds);
    for (const m of (members ?? []) as { user_id: string | null }[]) {
      if (m.user_id) ids.add(m.user_id);
    }
  }

  return [...ids];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ShowForArtwork {
  id: string;
  title: string;
  gallery_id: string;
}

/**
 * Published shows that currently feature this artwork and haven't closed yet
 * (upcoming or running). Matches the artist's certificate and the show's own
 * Certificate of Show, since visitors may ask about either.
 */
export async function getOpenShowsForArtwork(
  adminClient: SupabaseClient,
  artworkId: string,
): Promise<ShowForArtwork[]> {
  // The id goes into a PostgREST `or` filter, so only ever a bare UUID.
  if (!UUID_RE.test(artworkId)) return [];
  const admin = asUntyped(adminClient);

  const { data: links } = await admin
    .from('exhibition_artworks')
    .select('exhibition_id, status')
    .or(`artwork_id.eq.${artworkId},cos_artwork_id.eq.${artworkId}`);
  const exhibitionIds = [
    ...new Set(
      ((links ?? []) as { exhibition_id: string; status: unknown }[])
        .filter((l) => isShownInExhibition(l.status))
        .map((l) => l.exhibition_id),
    ),
  ];
  if (exhibitionIds.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data: shows } = await admin
    .from('exhibitions')
    .select('id, title, gallery_id, published_at, end_date')
    .in('id', exhibitionIds)
    .not('published_at', 'is', null);

  return ((shows ?? []) as (ShowForArtwork & { end_date: string | null })[])
    .filter((s) => !s.end_date || s.end_date.slice(0, 10) >= today)
    .map(({ id, title, gallery_id }) => ({ id, title, gallery_id }));
}
