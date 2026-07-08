import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';
import { getOpenCallsList } from '~/app/open-calls/_actions/get-open-calls-list';
import { computeValuationInputs } from '~/lib/valuation/compute-valuation-inputs';
import { mergeNewsPublicationsDeduped } from '~/lib/news-publications';
import type { ArtistCvJson } from '~/lib/grants';
import type { NewsPublicationInput } from '~/lib/news-publications';
import OpenAI from 'openai';
import {
  generateArtistStatement,
  generateExhibitionText,
  generateOpenCallSubmission,
  generateCollectorOutreach,
  generateWebsiteBio,
  generatePracticeSummary,
} from './writing-helpers';
import { SITE_TEMPLATES, SITE_ACCENTS, SITE_FONT_PAIRINGS, SITE_SURFACES, DEFAULT_THEME, DEFAULT_SECTIONS, DEFAULT_SURFACE } from '~/app/_sites/types';
import { upsertSiteAction } from '~/app/profile/site/_actions/upsert-site';
import { publishSiteAction } from '~/app/profile/site/_actions/publish-site';

/* -------------------------------------------------------------------------- */
/*  search_artworks                                                           */
/* -------------------------------------------------------------------------- */

export async function handleSearchArtworks(
  args: { query?: string },
  userId: string,
): Promise<unknown> {
  const query = (args.query ?? '').trim().slice(0, 100);
  if (query.length < 2) {
    return { results: [], note: 'Query too short — needs at least 2 characters.' };
  }

  console.log('[Taco] handleSearchArtworks query=', query);

  const client = getSupabaseServerClient();

  const { data, error } = await (client as ReturnType<typeof getSupabaseServerClient> & {
    from(table: string): any;
  })
    .from('artworks')
    .select('id, title, artist_name, image_url, status, is_public')
    .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
    .eq('status', 'verified')
    .or(`is_public.eq.true,account_id.eq.${userId}`)
    .limit(15);

  if (error) {
    console.error('[Taco] handleSearchArtworks db error', error);
    return { results: [], error: error.message };
  }

  const results = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    artist_name: row.artist_name,
    image_url: row.image_url,
  }));

  console.log('[Taco] handleSearchArtworks returned', results.length, 'results');
  return { results };
}

/* -------------------------------------------------------------------------- */
/*  search_artists                                                            */
/* -------------------------------------------------------------------------- */

export async function handleSearchArtists(args: { query?: string }): Promise<unknown> {
  const query = (args.query ?? '').trim().slice(0, 100);
  if (query.length < 2) {
    return { results: [], note: 'Query too short.' };
  }

  console.log('[Taco] handleSearchArtists query=', query);

  const client = getSupabaseServerClient();

  // Search user_profiles with role=artist
  const { data, error } = await (client as any)
    .from('user_profiles')
    .select('id, name, location, bio, medium')
    .eq('role', 'artist')
    .ilike('name', `%${query}%`)
    .limit(15);

  if (error) {
    console.error('[Taco] handleSearchArtists db error', error);
    return { results: [], error: error.message };
  }

  const results = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    location: row.location,
    medium: row.medium,
  }));

  console.log('[Taco] handleSearchArtists returned', results.length, 'results');
  return { results };
}

/* -------------------------------------------------------------------------- */
/*  get_my_collection                                                         */
/* -------------------------------------------------------------------------- */

export async function handleGetMyCollection(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetMyCollection userId=', userId);

  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('artworks')
    .select('id, title, artist_name, creation_date, medium, image_url, status, certificate_type, is_public')
    .eq('account_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[Taco] handleGetMyCollection db error', error);
    return { artworks: [], error: error.message };
  }

  const artworks = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    artist_name: row.artist_name,
    year: row.creation_date ? new Date(row.creation_date).getFullYear() : null,
    medium: row.medium,
    status: row.status,
    certificate_type: row.certificate_type,
    is_public: row.is_public,
  }));

  console.log('[Taco] handleGetMyCollection returned', artworks.length, 'artworks');
  return { artworks, total: artworks.length };
}

/* -------------------------------------------------------------------------- */
/*  list_my_exhibitions                                                       */
/* -------------------------------------------------------------------------- */

export async function handleListMyExhibitions(userId: string): Promise<unknown> {
  console.log('[Taco] handleListMyExhibitions userId=', userId);

  try {
    const exhibitions = await getUserExhibitions(userId);
    console.log('[Taco] handleListMyExhibitions returned', exhibitions.length, 'exhibitions');
    return { exhibitions };
  } catch (err) {
    console.error('[Taco] handleListMyExhibitions error', err);
    return { exhibitions: [], error: err instanceof Error ? err.message : 'Failed to fetch exhibitions' };
  }
}

/* -------------------------------------------------------------------------- */
/*  suggest_navigation                                                        */
/* -------------------------------------------------------------------------- */

export type NavigationSuggestion = { label: string; href: string };

export function handleSuggestNavigation(args: {
  suggestions?: NavigationSuggestion[];
}): NavigationSuggestion[] {
  const raw = args.suggestions ?? [];
  const valid = raw.filter(
    (s) =>
      typeof s.label === 'string' &&
      s.label.trim().length > 0 &&
      typeof s.href === 'string' &&
      s.href.startsWith('/'),
  );
  console.log('[Taco] handleSuggestNavigation', valid.length, 'suggestions');
  return valid.slice(0, 4);
}

/* ========================================================================== */
/*  PHASE 1 — Pure read tools                                                 */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  get_my_grants                                                             */
/* -------------------------------------------------------------------------- */

export async function handleGetMyGrants(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetMyGrants userId=', userId);
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('artist_grants')
    .select('id, name, type, description, deadline, amount, url, bookmarked, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[Taco] handleGetMyGrants db error', error);
    return { grants: [], error: error.message };
  }

  const grants = (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    deadline: g.deadline,
    amount: g.amount,
    url: g.url,
    bookmarked: g.bookmarked,
  }));

  console.log('[Taco] handleGetMyGrants returned', grants.length, 'grants');
  return { grants, total: grants.length };
}

/* -------------------------------------------------------------------------- */
/*  get_my_profile                                                            */
/* -------------------------------------------------------------------------- */

export async function handleGetMyProfile(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetMyProfile userId=', userId);
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('user_profiles')
    .select('id, role, name, bio, medium, location, website, links, has_sold_work, artist_cv_json, onboarding_answers, onboarding_completed_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Taco] handleGetMyProfile db error', error);
    return { profiles: [], error: error.message };
  }

  const profiles = (data ?? []).map((p: any) => ({
    id: p.id,
    role: p.role,
    name: p.name,
    bio: p.bio,
    medium: p.medium,
    location: p.location,
    website: p.website,
    links: p.links,
    has_sold_work: p.has_sold_work,
    has_cv: Boolean(p.artist_cv_json),
    goal: (p.onboarding_answers as Record<string, unknown> | null)?.goal ?? null,
  }));

  console.log('[Taco] handleGetMyProfile returned', profiles.length, 'profiles');
  return { profiles };
}

/* -------------------------------------------------------------------------- */
/*  get_my_sales                                                              */
/* -------------------------------------------------------------------------- */

export async function handleGetMySales(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetMySales userId=', userId);
  const client = getSupabaseServerClient();

  const { data: artworkIds } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('account_id', userId)
    .limit(200);

  const ids = Array.isArray(artworkIds) ? (artworkIds as any[]).map((a) => a.id as string) : [];

  if (!ids.length) {
    return { sales: [], total_count: 0, total_revenue_cents: 0 };
  }

  const { data, error } = await (client as any)
    .from('sales_ledger')
    .select('id, artwork_id, price_cents, currency, sold_at, artworks(title, artist_name)')
    .in('artwork_id', ids)
    .order('sold_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Taco] handleGetMySales db error', error);
    return { sales: [], error: error.message };
  }

  const sales = (data ?? []).map((s: any) => ({
    artwork_title: s.artworks?.title ?? 'Untitled',
    artist_name: s.artworks?.artist_name ?? null,
    price_cents: s.price_cents,
    currency: s.currency ?? 'USD',
    sold_at: s.sold_at,
  }));

  const totalRevenueCents = sales.reduce((sum: number, s: any) => sum + (s.price_cents ?? 0), 0);

  console.log('[Taco] handleGetMySales returned', sales.length, 'sales');
  return { sales, total_count: sales.length, total_revenue_cents: totalRevenueCents };
}

/* -------------------------------------------------------------------------- */
/*  get_portal_stats                                                          */
/* -------------------------------------------------------------------------- */

export async function handleGetPortalStats(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetPortalStats userId=', userId);
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('entity_stats')
    .select('*')
    .eq('entity_account_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Taco] handleGetPortalStats db error', error);
    return { stats: null, error: error.message };
  }

  if (!data) {
    return { stats: null, note: 'No stats yet — add artworks and exhibitions to build your portfolio data.' };
  }

  const stats = {
    market_cap_cents: data.market_cap_cents ?? 0,
    artworks_produced_count: data.artworks_produced_count ?? 0,
    exhibition_count: data.exhibition_count ?? 0,
    museum_exhibition_count: data.museum_exhibition_count ?? 0,
    total_sales_count: data.total_sales_count ?? 0,
    rarity_index: data.rarity_index ?? 0,
  };

  console.log('[Taco] handleGetPortalStats returned stats');
  return { stats };
}

/* -------------------------------------------------------------------------- */
/*  get_open_calls                                                            */
/* -------------------------------------------------------------------------- */

export async function handleGetOpenCalls(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetOpenCalls userId=', userId);

  // Get the user's medium + location for filtering
  const client = getSupabaseServerClient();
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('medium, location')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  try {
    const openCalls = await getOpenCallsList({
      medium: (profile?.medium as string | null) ?? null,
      locationFilter: null,
      userLocation: (profile?.location as string | null) ?? null,
    });

    const results = openCalls.slice(0, 20).map((oc) => ({
      id: oc.id,
      title: oc.exhibition?.title ?? 'Untitled',
      gallery_name: oc.gallery_name,
      medium: oc.medium,
      closing_date: oc.submission_closing_date,
      location: oc.exhibition?.location,
      description: oc.exhibition?.description,
    }));

    console.log('[Taco] handleGetOpenCalls returned', results.length, 'open calls');
    return { open_calls: results, total: results.length };
  } catch (err) {
    console.error('[Taco] handleGetOpenCalls error', err);
    return { open_calls: [], error: err instanceof Error ? err.message : 'Failed to fetch open calls' };
  }
}

/* -------------------------------------------------------------------------- */
/*  summarize_practice                                                        */
/* -------------------------------------------------------------------------- */

export async function handleSummarizePractice(userId: string, apiKey: string): Promise<unknown> {
  console.log('[Taco] handleSummarizePractice userId=', userId);
  const client = getSupabaseServerClient();

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('name, bio, medium, artist_cv_json, has_sold_work')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  const { count: artworkCount } = await (client as any)
    .from('artworks')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', userId);

  const exhibitions = await getUserExhibitions(userId).catch(() => []);

  const { text, error } = await generatePracticeSummary(apiKey, {
    name: (profile?.name as string | null) ?? null,
    medium: (profile?.medium as string | null) ?? null,
    bio: (profile?.bio as string | null) ?? null,
    cvJson: (profile?.artist_cv_json as ArtistCvJson | null) ?? null,
    artworkCount: (artworkCount as number | null) ?? 0,
    exhibitionCount: exhibitions.length,
    hasSoldWork: (profile?.has_sold_work as string | null) ?? null,
  });

  if (error) {
    return { summary: null, error };
  }

  console.log('[Taco] handleSummarizePractice done');
  return { summary: text };
}

/* ========================================================================== */
/*  PHASE 2 — Write / create mutations                                        */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  create_exhibition                                                         */
/* -------------------------------------------------------------------------- */

export async function handleCreateExhibition(
  args: {
    title: string;
    start_date: string;
    description?: string;
    location?: string;
    end_date?: string;
  },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleCreateExhibition', { title: args.title, start_date: args.start_date });

  const client = getSupabaseServerClient();

  const { data: account } = await (client as any)
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .single();

  const userRole = (account?.public_data as Record<string, unknown> | null)?.role as string ?? 'artist';
  const ownerRole: 'artist' | 'gallery' | 'collector' | 'institution' =
    (['artist', 'gallery', 'collector', 'institution'] as const).includes(userRole as any)
      ? (userRole as 'artist' | 'gallery' | 'collector' | 'institution')
      : 'artist';

  const { data: exhibition, error } = await (client as any)
    .from('exhibitions')
    .insert({
      gallery_id: userId,
      owner_role: ownerRole,
      title: args.title.trim(),
      description: args.description?.trim() || null,
      start_date: args.start_date,
      end_date: args.end_date || null,
      location: args.location?.trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Taco] handleCreateExhibition insert failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Taco] handleCreateExhibition created', exhibition.id);
  return {
    success: true,
    exhibition_id: exhibition.id,
    navigation: [{ label: 'Open exhibition', href: `/exhibitions` }],
  };
}

/* -------------------------------------------------------------------------- */
/*  add_cv_entry                                                              */
/* -------------------------------------------------------------------------- */

export async function handleAddCvEntry(
  args: {
    entry_type: 'exhibition' | 'education' | 'award' | 'residency' | 'publication';
    name: string;
    venue_or_institution?: string;
    year?: string;
    description?: string;
  },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleAddCvEntry', { entry_type: args.entry_type, name: args.name });

  const client = getSupabaseServerClient();

  const { data: profile, error: fetchErr } = await (client as any)
    .from('user_profiles')
    .select('id, artist_cv_json')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  if (fetchErr || !profile) {
    console.error('[Taco] handleAddCvEntry no artist profile', fetchErr);
    return { success: false, error: 'No artist profile found. Create one first from Profiles.' };
  }

  const cvJson: ArtistCvJson = (profile.artist_cv_json as ArtistCvJson | null) ?? {};

  const newEntry: Record<string, string | undefined> = {
    name: args.name,
    year: args.year,
    description: args.description,
  };

  switch (args.entry_type) {
    case 'exhibition': {
      const exhibitions = Array.isArray(cvJson.exhibitions) ? [...cvJson.exhibitions] : [];
      exhibitions.unshift({ name: args.name, venue: args.venue_or_institution, year: args.year });
      cvJson.exhibitions = exhibitions;
      break;
    }
    case 'education': {
      const education = Array.isArray(cvJson.education) ? [...cvJson.education] : [];
      education.unshift({ degree: args.name, institution: args.venue_or_institution, year: args.year });
      cvJson.education = education;
      break;
    }
    default: {
      // awards, residencies, publications stored in a generic extras key
      const key = `${args.entry_type}s` as string;
      const existing = Array.isArray((cvJson as any)[key]) ? [...(cvJson as any)[key]] : [];
      existing.unshift({ ...newEntry, institution: args.venue_or_institution });
      (cvJson as any)[key] = existing;
    }
  }

  const { error: updateErr } = await (client as any)
    .from('user_profiles')
    .update({ artist_cv_json: cvJson })
    .eq('id', profile.id);

  if (updateErr) {
    console.error('[Taco] handleAddCvEntry update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  console.log('[Taco] handleAddCvEntry saved entry type=', args.entry_type);
  return {
    success: true,
    entry_type: args.entry_type,
    name: args.name,
    note: 'CV updated. View it on your artist profile page.',
    navigation: [{ label: 'View profile', href: '/profiles' }],
  };
}

/* -------------------------------------------------------------------------- */
/*  update_artist_bio                                                         */
/* -------------------------------------------------------------------------- */

export async function handleUpdateArtistBio(
  args: { bio: string; role?: string },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleUpdateArtistBio userId=', userId);

  const client = getSupabaseServerClient();
  const role = args.role ?? 'artist';

  const { data: profile, error: fetchErr } = await (client as any)
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .eq('is_active', true)
    .maybeSingle();

  if (fetchErr || !profile) {
    console.error('[Taco] handleUpdateArtistBio no profile', fetchErr);
    return { success: false, error: `No ${role} profile found.` };
  }

  const { error: updateErr } = await (client as any)
    .from('user_profiles')
    .update({ bio: args.bio.trim() })
    .eq('id', profile.id);

  if (updateErr) {
    console.error('[Taco] handleUpdateArtistBio update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  console.log('[Taco] handleUpdateArtistBio saved');
  return { success: true, note: 'Bio saved to your profile.' };
}

/* -------------------------------------------------------------------------- */
/*  search_press                                                              */
/* -------------------------------------------------------------------------- */

const WEB_SEARCH_MODEL = 'gpt-4o-search-preview';

export async function handleSearchPress(
  args: { artist_name?: string },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleSearchPress', { artist_name: args.artist_name });

  let artistName = args.artist_name?.trim() ?? null;

  if (!artistName) {
    const client = getSupabaseServerClient();
    const { data: profile } = await (client as any)
      .from('user_profiles')
      .select('name')
      .eq('user_id', userId)
      .eq('role', 'artist')
      .eq('is_active', true)
      .maybeSingle();
    artistName = (profile?.name as string | null) ?? null;
  }

  if (!artistName) {
    return { press: [], error: 'No artist name found. Please provide the artist name.' };
  }

  const prompt = `Search the web for press coverage, interviews, reviews, and news articles about the artist "${artistName}".

Return ONLY a valid JSON object with this structure:
{
  "items": [
    {
      "title": "Article or interview title",
      "url": "https://...",
      "publication_name": "Publication or outlet name",
      "date": "YYYY or YYYY-MM-DD if available",
      "excerpt": "1-2 sentence description of what the article covers"
    }
  ]
}

Return up to 10 real items with actual URLs. Only include genuine press coverage — not social media posts, gallery listings, or the artist's own website. If nothing is found, return {"items":[]}.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: WEB_SEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an art press research assistant. Search the web and return ONLY a valid JSON object. No markdown, no commentary.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    let parsed: { items?: unknown[] } = { items: [] };
    try {
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[Taco] handleSearchPress JSON parse failed', raw.slice(0, 200));
    }

    const items = Array.isArray(parsed.items)
      ? (parsed.items as any[])
          .filter((item) => typeof item.title === 'string' && typeof item.url === 'string' && item.url.startsWith('http'))
          .slice(0, 10)
      : [];

    console.log('[Taco] handleSearchPress found', items.length, 'press items');
    return {
      artist_name: artistName,
      press: items,
      total: items.length,
      note: items.length
        ? 'Tell me which items to add to your profile (e.g. "add 1, 3, and 5") and I\'ll save them.'
        : `No press found for "${artistName}". Try searching for a variation of your name.`,
    };
  } catch (err) {
    console.error('[Taco] handleSearchPress failed', err);
    return { press: [], error: err instanceof Error ? err.message : 'Web search failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  save_press_to_profile                                                     */
/* -------------------------------------------------------------------------- */

export async function handleSavePressToProfile(
  args: {
    items: NewsPublicationInput[];
  },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleSavePressToProfile', args.items.length, 'items');

  if (!args.items?.length) {
    return { success: false, error: 'No items provided.' };
  }

  const client = getSupabaseServerClient();

  const { data: profile, error: fetchErr } = await (client as any)
    .from('user_profiles')
    .select('id, news_publications')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !profile) {
    console.error('[Taco] handleSavePressToProfile no profile', fetchErr);
    return { success: false, error: 'No profile found.' };
  }

  const existing: NewsPublicationInput[] = Array.isArray(profile.news_publications)
    ? (profile.news_publications as NewsPublicationInput[])
    : [];

  const merged = mergeNewsPublicationsDeduped(existing, args.items);

  const { error: updateErr } = await (client as any)
    .from('user_profiles')
    .update({ news_publications: merged })
    .eq('id', profile.id);

  if (updateErr) {
    console.error('[Taco] handleSavePressToProfile update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  const added = merged.length - existing.length;
  console.log('[Taco] handleSavePressToProfile saved', added, 'new items');
  return {
    success: true,
    added,
    total: merged.length,
    note: `Added ${added} press item${added !== 1 ? 's' : ''} to your profile.`,
    navigation: [{ label: 'View profile', href: '/profiles' }],
  };
}

/* ========================================================================== */
/*  PHASE 3 — AI writing tools                                                */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  draft_artist_statement                                                    */
/* -------------------------------------------------------------------------- */

export async function handleDraftArtistStatement(
  args: { focus?: string },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleDraftArtistStatement', { focus: args.focus });

  const client = getSupabaseServerClient();
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('name, bio, medium, artist_cv_json')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  const { text, error } = await generateArtistStatement(apiKey, {
    name: (profile?.name as string | null) ?? null,
    medium: (profile?.medium as string | null) ?? null,
    bio: (profile?.bio as string | null) ?? null,
    cvJson: (profile?.artist_cv_json as ArtistCvJson | null) ?? null,
    focus: args.focus ?? null,
  });

  if (error) {
    return { statement: null, error };
  }

  console.log('[Taco] handleDraftArtistStatement done');
  return {
    statement: text,
    note: 'Say "save this as my bio" if you\'d like to save this to your profile.',
  };
}

/* -------------------------------------------------------------------------- */
/*  draft_exhibition_text                                                     */
/* -------------------------------------------------------------------------- */

export async function handleDraftExhibitionText(
  args: {
    exhibition_id?: string;
    exhibition_title?: string;
    format?: 'press_release' | 'wall_text' | 'catalogue_note';
  },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleDraftExhibitionText', { exhibition_id: args.exhibition_id, format: args.format });

  const client = getSupabaseServerClient();

  let exhibition: any = null;
  if (args.exhibition_id) {
    const { data } = await (client as any)
      .from('exhibitions')
      .select('id, title, description, start_date, end_date, location')
      .eq('id', args.exhibition_id)
      .maybeSingle();
    exhibition = data;
  } else if (args.exhibition_title) {
    const { data } = await (client as any)
      .from('exhibitions')
      .select('id, title, description, start_date, end_date, location')
      .eq('gallery_id', userId)
      .ilike('title', `%${args.exhibition_title}%`)
      .limit(1)
      .maybeSingle();
    exhibition = data;
  }

  if (!exhibition) {
    const exhibitions = await getUserExhibitions(userId).catch(() => []);
    if (exhibitions.length) {
      exhibition = exhibitions[0];
    }
  }

  // Fetch artworks and artist names from the exhibition
  let artworkTitles: string[] = [];
  let artistNames: string[] = [];
  if (exhibition?.id) {
    const { data: artworks } = await (client as any)
      .from('exhibition_artworks')
      .select('artworks(title, artist_name)')
      .eq('exhibition_id', exhibition.id)
      .limit(20);

    if (Array.isArray(artworks)) {
      artworkTitles = (artworks as any[])
        .map((a) => (Array.isArray(a.artworks) ? a.artworks[0]?.title : a.artworks?.title))
        .filter(Boolean);
      artistNames = [
        ...new Set(
          (artworks as any[])
            .map((a) => (Array.isArray(a.artworks) ? a.artworks[0]?.artist_name : a.artworks?.artist_name))
            .filter(Boolean),
        ),
      ];
    }
  }

  const format = args.format ?? 'press_release';
  const { text, error } = await generateExhibitionText(apiKey, {
    exhibitionTitle: exhibition?.title ?? 'Untitled Exhibition',
    description: exhibition?.description ?? null,
    location: exhibition?.location ?? null,
    startDate: exhibition?.start_date ?? null,
    endDate: exhibition?.end_date ?? null,
    artworkTitles,
    artistNames,
    format,
  });

  if (error) {
    return { text: null, error };
  }

  console.log('[Taco] handleDraftExhibitionText done format=', format);
  return { text, format, exhibition_title: exhibition?.title ?? null };
}

/* -------------------------------------------------------------------------- */
/*  draft_open_call_submission                                                */
/* -------------------------------------------------------------------------- */

export async function handleDraftOpenCallSubmission(
  args: { open_call_id?: string; open_call_title?: string },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleDraftOpenCallSubmission', args);

  const client = getSupabaseServerClient();

  let openCallTitle = args.open_call_title ?? 'Open Call';
  let openCallDescription: string | null = null;

  if (args.open_call_id) {
    const { data: oc } = await (client as any)
      .from('open_calls')
      .select('id, exhibitions(title, description)')
      .eq('id', args.open_call_id)
      .maybeSingle();
    if (oc?.exhibitions) {
      const ex = Array.isArray(oc.exhibitions) ? oc.exhibitions[0] : oc.exhibitions;
      openCallTitle = ex?.title ?? openCallTitle;
      openCallDescription = ex?.description ?? null;
    }
  }

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('name, bio, medium, artist_cv_json')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  const { text, error } = await generateOpenCallSubmission(apiKey, {
    openCallTitle,
    openCallDescription,
    artistName: (profile?.name as string | null) ?? null,
    medium: (profile?.medium as string | null) ?? null,
    bio: (profile?.bio as string | null) ?? null,
    cvJson: (profile?.artist_cv_json as ArtistCvJson | null) ?? null,
  });

  if (error) {
    return { text: null, error };
  }

  console.log('[Taco] handleDraftOpenCallSubmission done');
  return {
    text,
    open_call_title: openCallTitle,
    note: 'You can edit this in the Grants section or copy it into your application.',
    navigation: [{ label: 'Open calls', href: '/open-calls/browse' }],
  };
}

/* -------------------------------------------------------------------------- */
/*  draft_collector_outreach                                                  */
/* -------------------------------------------------------------------------- */

export async function handleDraftCollectorOutreach(
  args: { contact_name: string; context?: string },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleDraftCollectorOutreach', { contact: args.contact_name });

  const client = getSupabaseServerClient();

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('name')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  // Try to find this contact in the CRM
  const { data: leads } = await (client as any)
    .from('artist_leads')
    .select('contact_name, notes, stage')
    .eq('artist_user_id', userId)
    .ilike('contact_name', `%${args.contact_name}%`)
    .limit(1)
    .maybeSingle();

  const { text, error } = await generateCollectorOutreach(apiKey, {
    contactName: args.contact_name,
    artistName: (profile?.name as string | null) ?? null,
    context: args.context ?? null,
    notes: (leads?.notes as string | null) ?? null,
    stage: (leads?.stage as string | null) ?? null,
  });

  if (error) {
    return { email: null, error };
  }

  console.log('[Taco] handleDraftCollectorOutreach done');
  return {
    email: text,
    contact_name: args.contact_name,
    note: 'Copy and send via your email client, or use the CRM to track this contact.',
    navigation: [{ label: 'Open CRM', href: '/portal/or' }],
  };
}

/* -------------------------------------------------------------------------- */
/*  generate_website_bio                                                      */
/* -------------------------------------------------------------------------- */

export async function handleGenerateWebsiteBio(
  args: { length?: 'short' | 'medium' },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  console.log('[Taco] handleGenerateWebsiteBio', { length: args.length });

  const client = getSupabaseServerClient();
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('name, bio, medium, location, artist_cv_json')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  const { text, error } = await generateWebsiteBio(apiKey, {
    name: (profile?.name as string | null) ?? null,
    medium: (profile?.medium as string | null) ?? null,
    location: (profile?.location as string | null) ?? null,
    bio: (profile?.bio as string | null) ?? null,
    cvJson: (profile?.artist_cv_json as ArtistCvJson | null) ?? null,
    length: args.length ?? 'short',
  });

  if (error) {
    return { bio: null, error };
  }

  console.log('[Taco] handleGenerateWebsiteBio done');
  return {
    bio: text,
    length: args.length ?? 'short',
    note: 'Say "save this as my bio" to save it to your profile.',
  };
}

/* -------------------------------------------------------------------------- */
/*  suggest_pricing                                                           */
/* -------------------------------------------------------------------------- */

export async function handleSuggestPricing(
  args: { artwork_title: string },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleSuggestPricing', { artwork_title: args.artwork_title });

  const client = getSupabaseServerClient();
  const { data: artworks } = await (client as any)
    .from('artworks')
    .select('id, title, medium, creation_date')
    .eq('account_id', userId)
    .ilike('title', `%${args.artwork_title}%`)
    .limit(5);

  if (!Array.isArray(artworks) || !(artworks as any[]).length) {
    return { estimate: null, error: `No artwork found matching "${args.artwork_title}" in your collection.` };
  }

  const artwork = (artworks as any[])[0];
  const { inputs, error } = await computeValuationInputs(artwork.id);

  if (error || !inputs) {
    return { estimate: null, error: error ?? 'Could not compute valuation.' };
  }

  const det = inputs.deterministic_output;
  const fmt = (cents: number) =>
    cents > 0 ? `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null;

  console.log('[Taco] handleSuggestPricing done', artwork.title);
  return {
    artwork_title: artwork.title,
    estimate: fmt(det.estimated_value_cents),
    confidence_low: fmt(det.confidence_low_cents),
    confidence_high: fmt(det.confidence_high_cents),
    cultural_importance_score: det.cultural_importance_score,
    liquidity_score: det.liquidity_score,
    comparable_sales_count: inputs.auction_history_summary.count,
    note: 'This is an AI estimate based on comparable sales, exhibition history, and market signals. Not a formal appraisal.',
  };
}

/* ========================================================================== */
/*  PHASE 4 — Extended tools                                                  */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  get_collector_contacts                                                    */
/* -------------------------------------------------------------------------- */

export async function handleGetCollectorContacts(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetCollectorContacts userId=', userId);

  const client = getSupabaseServerClient();
  const { data, error } = await (client as any)
    .from('artist_leads')
    .select('id, contact_name, contact_email, contact_phone, notes, stage, follow_up_date, source, updated_at')
    .eq('artist_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[Taco] handleGetCollectorContacts db error', error);
    return { contacts: [], error: error.message };
  }

  const contacts = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.contact_name,
    email: c.contact_email,
    phone: c.contact_phone,
    stage: c.stage,
    notes: c.notes,
    follow_up_date: c.follow_up_date,
    source: c.source,
    last_activity: c.updated_at,
  }));

  console.log('[Taco] handleGetCollectorContacts returned', contacts.length, 'contacts');
  return { contacts, total: contacts.length };
}

/* -------------------------------------------------------------------------- */
/*  create_artwork_draft                                                      */
/* -------------------------------------------------------------------------- */

export async function handleCreateArtworkDraft(
  args: {
    title: string;
    medium?: string;
    year?: string;
    dimensions?: string;
    description?: string;
  },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleCreateArtworkDraft', { title: args.title });

  const client = getSupabaseServerClient();

  const { data: artwork, error } = await (client as any)
    .from('artworks')
    .insert({
      account_id: userId,
      title: args.title.trim(),
      medium: args.medium?.trim() || null,
      creation_date: args.year ? `${args.year}-01-01` : null,
      dimensions: args.dimensions?.trim() || null,
      description: args.description?.trim() || null,
      status: 'draft',
      is_public: false,
    })
    .select('id, title')
    .single();

  if (error) {
    console.error('[Taco] handleCreateArtworkDraft insert failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Taco] handleCreateArtworkDraft created', artwork.id);
  return {
    success: true,
    artwork_id: artwork.id,
    artwork_title: artwork.title,
    note: 'Draft artwork created. Open it to add images, provenance details, and issue a Certificate of Authenticity.',
    navigation: [{ label: 'View artwork', href: `/artworks/${artwork.id}` }],
  };
}

/* -------------------------------------------------------------------------- */
/*  search_comparable_sales                                                   */
/* -------------------------------------------------------------------------- */

export async function handleSearchComparableSales(
  args: { medium?: string; artist_name?: string },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleSearchComparableSales', args);

  const client = getSupabaseServerClient();

  let query = (client as any)
    .from('sales_ledger')
    .select('id, price_cents, currency, sold_at, artworks(title, artist_name, medium)')
    .order('sold_at', { ascending: false })
    .limit(20);

  if (args.artist_name) {
    const { data: artistArtworks } = await (client as any)
      .from('artworks')
      .select('id')
      .ilike('artist_name', `%${args.artist_name}%`)
      .limit(100);
    const ids = Array.isArray(artistArtworks)
      ? (artistArtworks as any[]).map((a) => a.id as string)
      : [];
    if (ids.length) {
      query = query.in('artwork_id', ids);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Taco] handleSearchComparableSales db error', error);
    return { sales: [], error: error.message };
  }

  let sales = (data ?? []).map((s: any) => {
    const artwork = Array.isArray(s.artworks) ? s.artworks[0] : s.artworks;
    return {
      artwork_title: artwork?.title ?? 'Untitled',
      artist_name: artwork?.artist_name ?? null,
      medium: artwork?.medium ?? null,
      price_cents: s.price_cents,
      currency: s.currency ?? 'USD',
      sold_at: s.sold_at,
    };
  });

  if (args.medium) {
    const med = args.medium.toLowerCase();
    sales = sales.filter((s: any) => s.medium?.toLowerCase().includes(med));
  }

  const avgCents = sales.length
    ? Math.round(sales.reduce((sum: number, s: any) => sum + (s.price_cents ?? 0), 0) / sales.length)
    : 0;

  console.log('[Taco] handleSearchComparableSales returned', sales.length, 'sales');
  return {
    sales,
    count: sales.length,
    average_price_cents: avgCents,
    average_price: avgCents > 0 ? `$${(avgCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  find_grants_for_me                                                        */
/* -------------------------------------------------------------------------- */

export async function handleFindGrantsForMe(userId: string): Promise<unknown> {
  console.log('[Taco] handleFindGrantsForMe userId=', userId);

  const client = getSupabaseServerClient();

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('medium, location')
    .eq('user_id', userId)
    .eq('role', 'artist')
    .eq('is_active', true)
    .maybeSingle();

  const medium = (profile?.medium as string | null) ?? null;
  const location = (profile?.location as string | null) ?? null;

  let query = (client as any)
    .from('artist_grants')
    .select('id, name, type, description, deadline, amount, url, eligible_locations, discipline')
    .eq('user_id', userId)
    .neq('bookmarked', true)
    .order('deadline', { ascending: true })
    .limit(20);

  const { data, error } = await query;

  if (error) {
    console.error('[Taco] handleFindGrantsForMe db error', error);
    return { grants: [], error: error.message };
  }

  // Prioritize grants that match the artist's medium or have no location restriction
  const grants = (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    deadline: g.deadline,
    amount: g.amount,
    url: g.url,
    eligible_locations: g.eligible_locations,
    discipline: g.discipline,
    relevance: scorGrantRelevance(g, medium, location),
  })).sort((a: any, b: any) => b.relevance - a.relevance);

  console.log('[Taco] handleFindGrantsForMe returned', grants.length, 'grants');
  return {
    grants,
    total: grants.length,
    artist_medium: medium,
    navigation: [{ label: 'Open Grants', href: '/grants' }],
  };
}

function scorGrantRelevance(grant: any, medium: string | null, location: string | null): number {
  let score = 0;
  if (medium && Array.isArray(grant.discipline)) {
    const med = medium.toLowerCase();
    if ((grant.discipline as string[]).some((d) => d.toLowerCase().includes(med))) score += 10;
  }
  if (Array.isArray(grant.eligible_locations) && !(grant.eligible_locations as string[]).length) {
    score += 5; // worldwide — always relevant
  }
  if (grant.deadline) {
    const days = Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / 86_400_000);
    if (days > 0 && days < 30) score += 8; // closing soon
    else if (days >= 30 && days < 90) score += 4;
  }
  return score;
}

/* -------------------------------------------------------------------------- */
/*  get_my_website                                                             */
/* -------------------------------------------------------------------------- */

export async function handleGetMyWebsite(userId: string): Promise<unknown> {
  console.log('[Taco] handleGetMyWebsite userId=', userId);
  const client = getSupabaseServerClient();

  const { data: profiles, error: profileErr } = await (client as any)
    .from('user_profiles')
    .select('id, name, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(5);

  if (profileErr || !profiles?.length) {
    console.error('[Taco] handleGetMyWebsite no profiles', profileErr);
    return { error: 'No active profiles found for this account.' };
  }

  const profileIds = profiles.map((p: any) => p.id);
  const { data: sites, error: siteErr } = await (client as any)
    .from('profile_sites')
    .select('profile_id, handle, template_id, theme, sections, surface_color, tagline, display_name, about_override, published_at, featured_artwork_ids')
    .in('profile_id', profileIds);

  if (siteErr) {
    console.error('[Taco] handleGetMyWebsite site query failed', siteErr);
    return { error: siteErr.message };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.guru';
  const rawHost = new URL(baseUrl).hostname;
  const siteDomain = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost;

  const results = (sites ?? []).map((row: any) => {
    const profile = profiles.find((p: any) => p.id === row.profile_id);
    const theme = { ...DEFAULT_THEME, ...(row.theme ?? {}) };
    const sections = { ...DEFAULT_SECTIONS, ...(row.sections ?? {}) };
    return {
      profile_id: row.profile_id,
      profile_name: profile?.name ?? null,
      profile_role: profile?.role ?? null,
      handle: row.handle,
      published: !!row.published_at,
      site_url: row.published_at ? `https://${row.handle}.${siteDomain}` : null,
      editor_url: `/profile/site?profileId=${row.profile_id}`,
      template_id: row.template_id,
      accent: theme.accent,
      font_pairing: theme.font_pairing,
      text_color: theme.text_color ?? null,
      surface_color: row.surface_color ?? DEFAULT_SURFACE,
      tagline: row.tagline ?? null,
      display_name: row.display_name ?? null,
      about_override: row.about_override ?? null,
      sections,
      featured_artwork_ids: Array.isArray(row.featured_artwork_ids) ? row.featured_artwork_ids : [],
    };
  });

  // If no site exists yet, return profiles so Taco knows which profile_id to use
  const profilesWithoutSites = profiles.filter(
    (p: any) => !(sites ?? []).some((s: any) => s.profile_id === p.id),
  );

  console.log('[Taco] handleGetMyWebsite returned', results.length, 'sites,', profilesWithoutSites.length, 'profiles without sites');
  return {
    sites: results,
    profiles_without_sites: profilesWithoutSites.map((p: any) => ({ profile_id: p.id, name: p.name, role: p.role })),
    valid_options: {
      templates: SITE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, category: t.category })),
      accents: SITE_ACCENTS.map((a) => ({ key: a.key, label: a.label })),
      surfaces: SITE_SURFACES.map((s) => ({ key: s.key, label: s.label })),
      font_pairings: SITE_FONT_PAIRINGS.map((fp) => ({ key: fp.key, label: fp.label, description: fp.description })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  update_my_website                                                          */
/* -------------------------------------------------------------------------- */

export async function handleUpdateMyWebsite(
  args: {
    profile_id: string;
    handle?: string;
    template_id?: string;
    accent?: string;
    surface_color?: string;
    font_pairing?: string;
    text_color?: string | null;
    tagline?: string;
    display_name?: string;
    about_override?: string;
    sections?: Partial<Record<string, boolean>>;
  },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handleUpdateMyWebsite profileId=', args.profile_id);

  const client = getSupabaseServerClient();

  // Verify the profile belongs to this user
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, role, name')
    .eq('id', args.profile_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile || profile.user_id !== userId) {
    return { success: false, error: 'Profile not found or access denied.' };
  }

  // Fetch existing site row for defaults
  const { data: existing } = await (client as any)
    .from('profile_sites')
    .select('*')
    .eq('profile_id', args.profile_id)
    .maybeSingle();

  const existingTheme = { ...DEFAULT_THEME, ...(existing?.theme ?? {}) };
  const existingSections = { ...DEFAULT_SECTIONS, ...(existing?.sections ?? {}) };

  const newTheme: typeof existingTheme = {
    ...existingTheme,
    ...(args.accent !== undefined ? { accent: args.accent } : {}),
    ...(args.font_pairing !== undefined ? { font_pairing: args.font_pairing } : {}),
    ...(args.text_color !== undefined ? { text_color: args.text_color } : {}),
  };

  const newSections = {
    ...existingSections,
    ...(args.sections ?? {}),
  };

  const validTemplates = SITE_TEMPLATES.map((t) => t.id);
  const templateId = (args.template_id && validTemplates.includes(args.template_id as any))
    ? args.template_id as any
    : existing?.template_id ?? 'studio';

  const result = await upsertSiteAction({
    profileId: args.profile_id,
    handle: args.handle ?? existing?.handle ?? profile.name?.toLowerCase().replace(/\s+/g, '-') ?? 'my-site',
    templateId,
    theme: newTheme,
    sections: newSections,
    cta: existing?.cta ?? null,
    tagline: args.tagline !== undefined ? args.tagline : existing?.tagline ?? null,
    displayName: args.display_name !== undefined ? args.display_name : existing?.display_name ?? null,
    aboutOverride: args.about_override !== undefined ? args.about_override : existing?.about_override ?? null,
    surfaceColor: args.surface_color ?? existing?.surface_color ?? DEFAULT_SURFACE,
    heroImageUrl: existing?.hero_image_url ?? null,
    logoImageUrl: existing?.logo_image_url ?? null,
    artworkFilters: existing?.artwork_filters ?? undefined,
  });

  if (!result.success) {
    console.error('[Taco] handleUpdateMyWebsite upsert failed', result.error);
    return {
      success: false,
      error: result.error,
      navigation: [{ label: 'Open website editor', href: `/profile/site?profileId=${args.profile_id}` }],
    };
  }

  console.log('[Taco] handleUpdateMyWebsite succeeded');
  return {
    success: true,
    note: 'Website updated. Reload the editor to see the changes.',
    navigation: [{ label: 'Open website editor', href: `/profile/site?profileId=${args.profile_id}` }],
  };
}

/* -------------------------------------------------------------------------- */
/*  publish_my_website                                                         */
/* -------------------------------------------------------------------------- */

export async function handlePublishMyWebsite(
  args: { profile_id: string; published: boolean },
  userId: string,
): Promise<unknown> {
  console.log('[Taco] handlePublishMyWebsite', { profileId: args.profile_id, published: args.published });

  const client = getSupabaseServerClient();
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('user_id')
    .eq('id', args.profile_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile || profile.user_id !== userId) {
    return { success: false, error: 'Profile not found or access denied.' };
  }

  const result = await publishSiteAction(args.profile_id, args.published);

  if (!result.success) {
    console.error('[Taco] handlePublishMyWebsite failed', result.error);
    return {
      success: false,
      error: result.error,
      navigation: [{ label: 'Open website editor', href: `/profile/site?profileId=${args.profile_id}` }],
    };
  }

  console.log('[Taco] handlePublishMyWebsite succeeded');
  return {
    success: true,
    published: args.published,
    site_url: (result as any).url ?? null,
    note: args.published ? `Your site is now live at ${(result as any).url}` : 'Your site has been unpublished.',
    navigation: [
      { label: 'Open website editor', href: `/profile/site?profileId=${args.profile_id}` },
      ...(args.published ? [{ label: 'View live site', href: (result as any).url ?? '' }] : []),
    ],
  };
}
