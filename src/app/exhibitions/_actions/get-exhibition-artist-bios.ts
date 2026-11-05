'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { isShownInExhibition } from '../_helpers/exhibition-submission-status';

export type ExhibitionArtistBio = {
  /** Stable per artist: profile id, account id, or the typed name. */
  key: string;
  name: string;
  /** Bio from the artist's profile, or '' when there is none. */
  bio: string;
  artworkIds: string[];
};

type ArtworkRow = {
  id: string;
  artist_name: string | null;
  artist_account_id: string | null;
  artist_profile_id: string | null;
};

type ProfileRow = { id: string; user_id: string | null; name: string | null; bio: string | null };

/**
 * Artist bios for an exhibition's wall labels, one entry per artist in the
 * show. Only people who can manage the exhibition may load them.
 */
export async function getExhibitionArtistBios(exhibitionId: string): Promise<ExhibitionArtistBio[]> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Sign in to print wall labels.');

  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('You can only print labels for exhibitions you manage.');
  }

  const { data: links, error: linksError } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status')
    .eq('exhibition_id', exhibitionId);
  if (linksError) {
    console.error('[Exhibitions] getExhibitionArtistBios: links fetch failed', linksError);
    throw new Error('Could not load the artists in this exhibition.');
  }
  const artworkIds = (links || [])
    .filter((l: { status?: string }) => isShownInExhibition(l.status))
    .map((l: { artwork_id: string }) => l.artwork_id)
    .filter(Boolean);
  if (artworkIds.length === 0) return [];

  const { data: artworkRows, error: artworksError } = await admin
    .from('artworks')
    .select('id, artist_name, artist_account_id, artist_profile_id')
    .in('id', artworkIds);
  if (artworksError) {
    console.error('[Exhibitions] getExhibitionArtistBios: artworks fetch failed', artworksError);
    throw new Error('Could not load the artists in this exhibition.');
  }
  const artworks = (artworkRows || []) as ArtworkRow[];

  const profileIds = [...new Set(artworks.map((a) => a.artist_profile_id).filter(Boolean))] as string[];
  const accountIds = [
    ...new Set(
      artworks.filter((a) => !a.artist_profile_id && a.artist_account_id).map((a) => a.artist_account_id),
    ),
  ] as string[];

  const byProfileId = new Map<string, ProfileRow>();
  const byAccountId = new Map<string, ProfileRow>();

  if (profileIds.length > 0) {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, user_id, name, bio')
      .in('id', profileIds)
      .eq('is_active', true);
    if (error) console.error('[Exhibitions] getExhibitionArtistBios: profile bios failed', error);
    for (const row of (data || []) as ProfileRow[]) byProfileId.set(row.id, row);
  }
  if (accountIds.length > 0) {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, user_id, name, bio')
      .in('user_id', accountIds)
      .eq('role', 'artist')
      .eq('is_active', true);
    if (error) console.error('[Exhibitions] getExhibitionArtistBios: account bios failed', error);
    for (const row of (data || []) as ProfileRow[]) if (row.user_id) byAccountId.set(row.user_id, row);
  }

  const artists = new Map<string, ExhibitionArtistBio>();
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

    const entry = artists.get(key) ?? { key, name: name || 'Unknown artist', bio: profile?.bio?.trim() ?? '', artworkIds: [] };
    entry.artworkIds.push(a.id);
    artists.set(key, entry);
  }

  const result = [...artists.values()].sort((x, y) => x.name.localeCompare(y.name));
  console.log('[Exhibitions] getExhibitionArtistBios', {
    exhibitionId,
    artists: result.length,
    withBio: result.filter((r) => r.bio).length,
  });
  return result;
}
