'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  resolveArtistBios,
  type ArtistBio,
  type ArtistBioArtworkRow,
} from '~/app/exhibitions/_helpers/artist-bios';

const MAX_ARTWORKS = 1000;

/**
 * Artist bios for collection wall labels, one entry per artist among the
 * chosen works. Works are read with the signed-in user's own access, so only
 * works they can already see are included.
 */
export async function getArtworkArtistBios(artworkIds: string[]): Promise<ArtistBio[]> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Sign in to print wall labels.');

  const ids = [...new Set((artworkIds ?? []).filter((id) => typeof id === 'string' && id))].slice(0, MAX_ARTWORKS);
  if (ids.length === 0) return [];

  const { data, error } = await asUntyped(client)
    .from('artworks')
    .select('id, artist_name, artist_account_id, artist_profile_id')
    .in('id', ids);
  if (error) {
    console.error('[Collection] getArtworkArtistBios: artworks fetch failed', error);
    throw new Error('Could not load the artists for these works.');
  }

  const artworks = (data || []) as ArtistBioArtworkRow[];
  console.log('[Collection] getArtworkArtistBios', { requested: ids.length, works: artworks.length });
  return resolveArtistBios(asUntyped(getSupabaseServerAdminClient()), artworks, '[Collection]');
}
