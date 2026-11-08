'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { isShownInExhibition } from '../_helpers/exhibition-submission-status';
import { resolveArtistBios, type ArtistBio, type ArtistBioArtworkRow } from '../_helpers/artist-bios';

export type ExhibitionArtistBio = ArtistBio;

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
  const artworks = (artworkRows || []) as ArtistBioArtworkRow[];
  console.log('[Exhibitions] getExhibitionArtistBios', { exhibitionId, works: artworks.length });
  return resolveArtistBios(admin, artworks, '[Exhibitions]');
}
