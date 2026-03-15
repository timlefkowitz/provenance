'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { Grant } from '~/lib/grants';

export type ArtistGrantRow = Grant & {
  id: string;
  user_id: string | null; // null = curated grant (visible to all)
  created_at: string;
  updated_at: string;
};

/**
 * Get grants for the current user: their saved grants plus curated (shared) grants.
 */
export async function getArtistGrants(userId: string): Promise<ArtistGrantRow[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await (client as any)
    .from('artist_grants')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('deadline', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[Grants] getArtistGrants failed', error);
    return [];
  }
  return (data || []) as ArtistGrantRow[];
}
