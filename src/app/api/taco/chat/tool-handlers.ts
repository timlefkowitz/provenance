import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';

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
  // Validate hrefs start with / and labels are strings
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
