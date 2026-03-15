'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getMediumLabel } from './open-call-constants';

export type OpenCallListEntry = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  submission_open_date: string | null;
  submission_closing_date: string | null;
  call_type: string | null;
  medium: string | null;
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
  /** Filter by medium (e.g. painting, sculpture). */
  medium?: string | null;
  /** 'my' = only where user qualifies; 'none' = only no location requirement; otherwise all. */
  locationFilter?: 'my' | 'none' | null;
  /** User's location string (state/zip) for 'my' filter. */
  userLocation?: string | null;
  /** Search in title, description, gallery name, and medium (case-insensitive). */
  search?: string | null;
};

const LIST_PAGE_SIZE = 20;

/** Only exhibition-style open calls (show artwork). Residencies/grants are excluded. */
const EXHIBITION_CALL_TYPES = ['exhibition', 'art'];

/**
 * Fetch public open calls for artists to browse.
 * Only returns exhibition open calls that are currently open for submissions.
 * Optional filter by type (exhibition/art) and location eligibility.
 */
export async function getOpenCallsList(
  filters?: OpenCallsListFilters,
): Promise<OpenCallListEntry[]> {
  const client = getSupabaseServerClient();

  const todayIso = new Date().toISOString().split('T')[0];
  console.log('[OpenCalls] getOpenCallsList started', {
    medium: filters?.medium,
    locationFilter: filters?.locationFilter,
    hasSearch: Boolean(filters?.search),
    today: todayIso,
  });

  let query = (client as any)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, submission_open_date, submission_closing_date, call_type, medium, eligible_locations, exhibition:exhibition_id (id, title, start_date, end_date, location, description)',
    )
    .order('created_at', { ascending: false })
    .limit(LIST_PAGE_SIZE);

  // Only exhibition open calls (show artwork)
  query = query.in('call_type', EXHIBITION_CALL_TYPES);

  // Filter by medium when provided
  if (filters?.medium && filters.medium.trim()) {
    query = query.eq('medium', filters.medium.trim());
  }

  // Only currently open for submissions (closing date in future or null)
  query = query.or(`submission_closing_date.gte.${todayIso},submission_closing_date.is.null`);

  const { data, error } = await query;

  if (error) {
    console.error('[OpenCalls] getOpenCallsList failed', error);
    return [];
  }

  let list = (data || []) as OpenCallListEntry[];

  if (filters?.locationFilter === 'none') {
    list = list.filter((oc) => {
      const locs = oc.eligible_locations ?? [];
      return locs.length === 0;
    });
  } else if (filters?.locationFilter === 'my' && filters?.userLocation?.trim()) {
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

  let withNames = list.map((oc) => ({
    ...oc,
    gallery_name: nameById.get(oc.gallery_profile_id) ?? null,
  }));

  // Search in title, description, gallery name, and medium
  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase();
    withNames = withNames.filter((oc) => {
      const title = (oc.exhibition?.title ?? '').toLowerCase();
      const desc = (oc.exhibition?.description ?? '').toLowerCase();
      const gallery = (oc.gallery_name ?? '').toLowerCase();
      const mediumLabel = getMediumLabel(oc.medium).toLowerCase();
      return title.includes(term) || desc.includes(term) || gallery.includes(term) || mediumLabel.includes(term);
    });
  }

  console.log('[OpenCalls] getOpenCallsList ok', { count: withNames.length });
  return withNames;
}
