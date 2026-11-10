import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

export type ArtistBio = {
  /** Stable per artist: profile id, account id, or the typed name. */
  key: string;
  name: string;
  /** Bio from the artist's profile, or '' when there is none. */
  bio: string;
  artworkIds: string[];
  /** The artist's profile row when one was found (full details for the curator). */
  profile?: ArtistBioProfile;
};

export type ArtistBioProfile = {
  id: string;
  user_id: string | null;
  name: string | null;
  bio: string | null;
  picture_url: string | null;
  website: string | null;
  artist_statement: string | null;
  birth_year: number | null;
  birth_place: string | null;
  nationality: string | null;
  death_year: number | null;
  is_claimed: boolean | null;
  created_by_gallery_id: string | null;
  artist_cv_json: unknown;
  news_publications: unknown;
  medium: string | null;
  location: string | null;
};

export type ArtistBioArtworkRow = {
  id: string;
  artist_name: string | null;
  artist_account_id: string | null;
  artist_profile_id: string | null;
};

type ProfileRow = ArtistBioProfile;

// Statement/tombstone columns arrive with migration 20261112000000; fall back
// to the base columns if they're not there yet.
const PROFILE_COLUMNS_FULL =
  'id, user_id, name, bio, picture_url, website, artist_statement, birth_year, birth_place, nationality, death_year, is_claimed, created_by_gallery_id, artist_cv_json, news_publications, medium, location';
const PROFILE_COLUMNS_BASE =
  'id, user_id, name, bio, picture_url, website, is_claimed, created_by_gallery_id, artist_cv_json, news_publications, medium, location';

async function selectProfiles(
  run: (columns: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<{ data: ProfileRow[]; error: { message?: string } | null }> {
  const full = await run(PROFILE_COLUMNS_FULL);
  if (!full.error) return { data: (full.data || []) as ProfileRow[], error: null };
  if (!/column/i.test(full.error.message ?? '')) return { data: [], error: full.error };
  const base = await run(PROFILE_COLUMNS_BASE);
  return { data: (base.data || []) as ProfileRow[], error: base.error };
}

/**
 * Groups works by artist and attaches each artist's profile bio, for printing
 * wall labels. Server only (admin client); callers check who may see the
 * works before calling this.
 */
export async function resolveArtistBios(
  admin: UntypedSupabaseClient,
  artworks: ArtistBioArtworkRow[],
  logTag: string,
): Promise<ArtistBio[]> {
  const profileIds = [...new Set(artworks.map((a) => a.artist_profile_id).filter(Boolean))] as string[];
  const accountIds = [
    ...new Set(
      artworks.filter((a) => !a.artist_profile_id && a.artist_account_id).map((a) => a.artist_account_id),
    ),
  ] as string[];

  const byProfileId = new Map<string, ProfileRow>();
  const byAccountId = new Map<string, ProfileRow>();

  if (profileIds.length > 0) {
    const { data, error } = await selectProfiles((cols) =>
      admin.from('user_profiles').select(cols).in('id', profileIds).eq('is_active', true),
    );
    if (error) console.error(`${logTag} artist bios: profile bios failed`, error);
    for (const row of data) byProfileId.set(row.id, row);
  }
  if (accountIds.length > 0) {
    const { data, error } = await selectProfiles((cols) =>
      admin.from('user_profiles').select(cols).in('user_id', accountIds).eq('role', 'artist').eq('is_active', true),
    );
    if (error) console.error(`${logTag} artist bios: account bios failed`, error);
    for (const row of data) if (row.user_id) byAccountId.set(row.user_id, row);
  }

  const artists = new Map<string, ArtistBio>();
  for (const a of artworks) {
    const profile = a.artist_profile_id
      ? byProfileId.get(a.artist_profile_id)
      : a.artist_account_id
        ? byAccountId.get(a.artist_account_id)
        : undefined;
    const name = a.artist_name?.trim() || profile?.name?.trim() || '';
    const key = a.artist_profile_id
      ? `profile:${a.artist_profile_id}`
      : a.artist_account_id
        ? `account:${a.artist_account_id}`
        : name
          ? `name:${name.toLowerCase()}`
          : null;
    if (!key) continue;

    const entry = artists.get(key) ?? {
      key,
      name: name || 'Unknown artist',
      bio: profile?.bio?.trim() ?? '',
      artworkIds: [],
      ...(profile ? { profile } : {}),
    };
    if (a.id) entry.artworkIds.push(a.id);
    artists.set(key, entry);
  }

  const result = [...artists.values()].sort((x, y) => x.name.localeCompare(y.name));
  console.log(`${logTag} artist bios`, {
    artists: result.length,
    withBio: result.filter((r) => r.bio).length,
  });
  return result;
}
