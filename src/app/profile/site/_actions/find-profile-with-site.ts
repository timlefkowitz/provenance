'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Among the given profile IDs, return the first one (by `profile_sites.updated_at desc`)
 * that has a saved site config. Returns null if none of them do.
 *
 * Used on the editor page to pick a sensible default profile when no
 * ?profileId= is in the URL — so refreshing /profile/site lands on the
 * profile the user actually configured, not the alphabetical/created-at first.
 */
export async function findProfileWithSite(
  profileIds: string[],
): Promise<string | null> {
  if (profileIds.length === 0) return null;

  console.log('[Sites] findProfileWithSite', { count: profileIds.length });

  const client = getSupabaseServerClient();
  const { data, error } = await (client as any)
    .from('profile_sites')
    .select('profile_id, updated_at, published_at')
    .in('profile_id', profileIds)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Sites] findProfileWithSite failed', error);
    return null;
  }

  const found = data?.profile_id ?? null;
  console.log('[Sites] findProfileWithSite resolved', { found });
  return found;
}
