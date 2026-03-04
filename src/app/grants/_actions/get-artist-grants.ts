'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { Grant } from '~/lib/grants';

export type ArtistGrantRow = Grant & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Get all persisted grants for the current user.
 */
export async function getArtistGrants(userId: string): Promise<ArtistGrantRow[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await (client as any)
    .from('artist_grants')
    .select('*')
    .eq('user_id', userId)
    .order('deadline', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching artist grants:', error);
    return [];
  }
  return (data || []) as ArtistGrantRow[];
}
