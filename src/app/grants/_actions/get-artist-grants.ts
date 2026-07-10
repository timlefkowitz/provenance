'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { Grant } from '~/lib/grants';

export type ArtistGrantRow = Grant & {
  id: string;
  user_id: string | null; // null = curated grant (visible to all)
  is_community: boolean;
  shared_by: string | null;
  shared_by_name: string | null;
  upvote_count: number;
  viewer_has_upvoted: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Get grants visible to the current user:
 *  - their own saved grants
 *  - platform-curated grants (user_id IS NULL)
 *  - community-shared grants (is_community = true)
 *
 * Also attaches viewer_has_upvoted for each grant.
 */
export async function getArtistGrants(userId: string): Promise<ArtistGrantRow[]> {
  console.log('[Grants] getArtistGrants', userId);
  const client = getSupabaseServerClient();

  // Fetch grants — RLS policy already covers the OR logic; still explicit for clarity
  const { data: grants, error: grantsError } = await asUntyped(client)
    .from('artist_grants')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null,is_community.eq.true`)
    .order('deadline', { ascending: true, nullsFirst: false });

  if (grantsError) {
    console.error('[Grants] getArtistGrants failed', grantsError);
    return [];
  }

  const rows = (grants || []) as (Grant & {
    id: string;
    user_id: string | null;
    is_community: boolean | null;
    shared_by: string | null;
    shared_by_name: string | null;
    upvote_count: number | null;
    created_at: string;
    updated_at: string;
  })[];

  if (rows.length === 0) return [];

  // Fetch the viewer's upvotes for these grants
  const grantIds = rows.map((g) => g.id);
  const { data: upvotes } = await asUntyped(client)
    .from('grant_upvotes')
    .select('grant_id')
    .eq('user_id', userId)
    .in('grant_id', grantIds);

  const upvotedSet = new Set<string>(
    ((upvotes as { grant_id: string }[]) || []).map((u) => u.grant_id),
  );

  return rows.map((g) => ({
    ...g,
    is_community: g.is_community ?? false,
    shared_by: g.shared_by ?? null,
    shared_by_name: g.shared_by_name ?? null,
    upvote_count: g.upvote_count ?? 0,
    viewer_has_upvoted: upvotedSet.has(g.id),
  }));
}
