import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getOpenCallsList } from '~/app/open-calls/_actions/get-open-calls-list';
import type { Grant, OpportunityType } from '~/lib/grants';

type SaveableOpportunity = Omit<
  Grant,
  'id' | 'user_id' | 'artist_profile_id' | 'created_at' | 'updated_at'
>;

// ─── search_open_calls ────────────────────────────────────────────────────────

type SearchOpenCallsArgs = {
  medium?: string;
  location_filter?: 'my' | 'none' | 'all';
};

export async function handleSearchOpenCalls(
  args: SearchOpenCallsArgs,
  artistLocation: string | null,
): Promise<{ open_calls: object[]; count: number }> {
  console.log('[Opportunities] handleSearchOpenCalls', args);

  const locationFilter =
    args.location_filter === 'my'
      ? 'my'
      : args.location_filter === 'none'
        ? 'none'
        : null;

  const openCalls = await getOpenCallsList({
    medium: args.medium ?? null,
    locationFilter,
    userLocation: locationFilter === 'my' ? artistLocation : null,
  });

  const simplified = openCalls.map((oc) => ({
    id: oc.id,
    type: 'open_call',
    title: oc.exhibition?.title ?? 'Untitled',
    gallery: oc.gallery_name ?? null,
    medium: oc.medium ?? null,
    location: oc.exhibition?.location ?? null,
    description: oc.exhibition?.description ?? null,
    deadline: oc.submission_closing_date ?? null,
    eligible_locations: oc.eligible_locations ?? [],
    call_type: oc.call_type ?? null,
  }));

  console.log('[Opportunities] handleSearchOpenCalls found', simplified.length);
  return { open_calls: simplified, count: simplified.length };
}

// ─── recommend_opportunities ──────────────────────────────────────────────────

type RecommendArgs = {
  opportunities: Array<{
    name: string;
    type: OpportunityType;
    description?: string;
    deadline?: string;
    amount?: string;
    eligible_locations?: string[];
    url?: string;
    discipline?: string[];
  }>;
};

export async function handleRecommendOpportunities(
  args: RecommendArgs,
  userId: string,
  artistProfileId: string | null,
): Promise<{ saved: number; opportunities: SaveableOpportunity[]; error: string | null }> {
  console.log('[Opportunities] handleRecommendOpportunities', args.opportunities?.length ?? 0);

  if (!args.opportunities?.length) {
    return { saved: 0, opportunities: [], error: null };
  }

  const rows = args.opportunities.map((o) => ({
    name: o.name || 'Untitled',
    type: (o.type ?? 'grant') as OpportunityType,
    description: o.description ?? null,
    deadline: o.deadline ?? null,
    amount: o.amount ?? null,
    eligible_locations: Array.isArray(o.eligible_locations) ? o.eligible_locations : [],
    url: o.url ?? null,
    discipline: Array.isArray(o.discipline) ? o.discipline : [],
    source: 'openai_agent',
  }));

  const client = getSupabaseServerClient();
  const insertRows = rows.map((r) => ({
    user_id: userId,
    artist_profile_id: artistProfileId,
    ...r,
  }));

  const { data, error } = await (client as any)
    .from('artist_grants')
    .insert(insertRows)
    .select('id');

  if (error) {
    console.error('[Opportunities] handleRecommendOpportunities insert failed', error);
    return { saved: 0, opportunities: rows, error: error.message };
  }

  console.log('[Opportunities] handleRecommendOpportunities saved', data?.length ?? 0);
  return { saved: data?.length ?? 0, opportunities: rows, error: null };
}
