'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { Grant } from '~/lib/grants';

/**
 * Insert new grants for the current user. Used by the chat API after OpenAI returns recommendations.
 */
export async function saveArtistGrants(
  userId: string,
  artistProfileId: string | null,
  grants: Omit<Grant, 'id' | 'user_id' | 'artist_profile_id' | 'created_at' | 'updated_at'>[]
): Promise<{ saved: number; error: string | null }> {
  if (!grants.length) return { saved: 0, error: null };

  console.log('[Grants] saveArtistGrants', grants.length, 'grants');
  const client = getSupabaseServerClient();
  const rows = grants.map((g) => ({
    user_id: userId,
    artist_profile_id: artistProfileId,
    name: g.name || 'Untitled',
    description: g.description ?? null,
    deadline: g.deadline ?? null,
    amount: g.amount ?? null,
    eligible_locations: Array.isArray(g.eligible_locations) ? g.eligible_locations : [],
    url: g.url ?? null,
    discipline: Array.isArray(g.discipline) ? g.discipline : [],
    source: g.source ?? 'openai',
    raw_response: g.raw_response ?? null,
  }));

  const { data, error } = await (client as any).from('artist_grants').insert(rows).select('id');

  if (error) {
    console.error('[Grants] saveArtistGrants insert failed', error);
    return { saved: 0, error: error.message };
  }
  console.log('[Grants] saveArtistGrants saved', data?.length ?? 0);
  return { saved: data?.length ?? 0, error: null };
}
