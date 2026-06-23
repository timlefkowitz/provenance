import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getOpenCallsList } from '~/app/open-calls/_actions/get-open-calls-list';
import type { Grant, OpportunityType } from '~/lib/grants';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';

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

// ─── draft_proposal ────────────────────────────────────────────────────────

type DraftProposalArgs = {
  title: string;
  grant_id?: string;
  grant_name?: string;
  project_summary?: string;
  artistic_statement?: string;
  project_description?: string;
  budget_overview?: string;
  timeline?: string;
};

/**
 * Assemble TipTap-compatible JSON from the AI-generated sections,
 * save a grant_proposals row, and return the new proposal id.
 */
export async function handleDraftProposal(
  args: DraftProposalArgs,
  userId: string,
): Promise<{ proposalId: string | null; error: string | null }> {
  console.log('[Proposals] handleDraftProposal', { title: args.title });

  const client = getSupabaseServerClient();

  // Build a plain-text version for search preview
  const sections: string[] = [];
  const addSection = (heading: string, body?: string) => {
    if (!body?.trim()) return;
    sections.push(`# ${heading}\n\n${body.trim()}`);
  };
  addSection('Project Summary', args.project_summary);
  addSection('Artistic Statement', args.artistic_statement);
  addSection('Project Description', args.project_description);
  addSection('Budget Overview', args.budget_overview);
  addSection('Timeline', args.timeline);
  const contentText = sections.join('\n\n---\n\n');

  // Build TipTap JSON document
  const makeHeading = (text: string) => ({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text }],
  });
  const makeParagraph = (text: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  });
  const makeRule = () => ({ type: 'horizontalRule' });

  const docContent: object[] = [];
  const addDocSection = (heading: string, body?: string) => {
    if (!body?.trim()) return;
    if (docContent.length > 0) docContent.push(makeRule());
    docContent.push(makeHeading(heading));
    body
      .trim()
      .split('\n\n')
      .forEach((para) => {
        if (para.trim()) docContent.push(makeParagraph(para.trim()));
      });
  };

  addDocSection('Project Summary', args.project_summary);
  addDocSection('Artistic Statement', args.artistic_statement);
  addDocSection('Project Description', args.project_description);
  addDocSection('Budget Overview', args.budget_overview);
  addDocSection('Timeline', args.timeline);

  if (docContent.length === 0) {
    docContent.push(makeParagraph('Your proposal draft will appear here. Start editing to refine it.'));
  }

  const contentJson = { type: 'doc', content: docContent };

  // Resolve artist profile id
  const artistProfile = await getUserProfileByRole(userId, USER_ROLES.ARTIST);

  const { data, error } = await (client as any)
    .from('grant_proposals')
    .insert({
      user_id: userId,
      artist_profile_id: artistProfile?.id ?? null,
      grant_id: args.grant_id ?? null,
      title: args.title,
      content_json: contentJson,
      content_text: contentText,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Proposals] handleDraftProposal insert failed', error);
    return { proposalId: null, error: error.message };
  }

  console.log('[Proposals] handleDraftProposal created', data.id);
  return { proposalId: data.id as string, error: null };
}
