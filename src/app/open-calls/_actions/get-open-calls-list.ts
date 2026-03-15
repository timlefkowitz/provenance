'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type OpenCallListEntry = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  exhibition: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    description: string | null;
  };
  gallery_name?: string | null;
};

/**
 * Fetch all public open calls for artists to browse.
 * Uses public read access (no auth required for the data).
 */
export async function getOpenCallsList(): Promise<OpenCallListEntry[]> {
  const client = getSupabaseServerClient();

  console.log('[OpenCalls] getOpenCallsList started');

  const { data, error } = await (client as any)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, exhibition:exhibition_id (id, title, start_date, end_date, location, description)',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[OpenCalls] getOpenCallsList failed', error);
    return [];
  }

  const list = (data || []) as OpenCallListEntry[];

  if (list.length === 0) {
    console.log('[OpenCalls] getOpenCallsList: no open calls found');
    return [];
  }

  const profileIds = [...new Set(list.map((oc) => oc.gallery_profile_id))];
  const { data: profiles } = await client
    .from('user_profiles')
    .select('id, name')
    .in('id', profileIds);

  const nameById = new Map(
    (profiles || []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );

  const withNames = list.map((oc) => ({
    ...oc,
    gallery_name: nameById.get(oc.gallery_profile_id) ?? null,
  }));

  console.log('[OpenCalls] getOpenCallsList ok', { count: withNames.length });
  return withNames;
}
