'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type OpenCallListEntry = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  submission_open_date: string | null;
  submission_closing_date: string | null;
  call_type: string | null;
  eligible_locations: string[] | null;
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

export type OpenCallsListFilters = {
  callType?: string | null;
  /** If set, only return open calls where eligible_locations is empty or includes this (case-insensitive match). */
  userLocation?: string | null;
};

const LIST_PAGE_SIZE = 20;

/**
 * Fetch public open calls for artists to browse.
 * Limit 20; optional filter by call type and location eligibility.
 */
export async function getOpenCallsList(
  filters?: OpenCallsListFilters,
): Promise<OpenCallListEntry[]> {
  const client = getSupabaseServerClient();

  console.log('[OpenCalls] getOpenCallsList started', { callType: filters?.callType, hasUserLocation: Boolean(filters?.userLocation) });

  let query = (client as any)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, submission_open_date, submission_closing_date, call_type, eligible_locations, exhibition:exhibition_id (id, title, start_date, end_date, location, description)',
    )
    .order('created_at', { ascending: false })
    .limit(LIST_PAGE_SIZE);

  if (filters?.callType) {
    query = query.eq('call_type', filters.callType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[OpenCalls] getOpenCallsList failed', error);
    return [];
  }

  let list = (data || []) as OpenCallListEntry[];

  if (filters?.userLocation && filters.userLocation.trim()) {
    const locationLower = filters.userLocation.trim().toLowerCase();
    list = list.filter((oc) => {
      const locs = oc.eligible_locations ?? [];
      if (locs.length === 0) return true;
      return locs.some((loc) => loc.toLowerCase().includes(locationLower) || locationLower.includes(loc.toLowerCase()));
    });
  }

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

/** True if submission period has ended (used for expired section). */
export function isOpenCallExpired(entry: OpenCallListEntry): boolean {
  const closing = entry.submission_closing_date;
  if (!closing) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closeDate = new Date(closing);
  closeDate.setHours(0, 0, 0, 0);
  return closeDate < today;
}

/** True if user's location qualifies (empty eligible_locations = qualifies). */
export function qualifiesByLocation(entry: OpenCallListEntry, userLocation: string | null): boolean {
  if (!userLocation?.trim()) return false;
  const locs = entry.eligible_locations ?? [];
  if (locs.length === 0) return true;
  const locationLower = userLocation.trim().toLowerCase();
  return locs.some((loc) => loc.toLowerCase().includes(locationLower) || locationLower.includes(loc.toLowerCase()));
}
