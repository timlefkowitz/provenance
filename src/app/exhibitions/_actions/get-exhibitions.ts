'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type Exhibition = {
  id: string;
  gallery_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
  owner_role: 'gallery' | 'institution' | null;
  created_at: string;
  updated_at: string;
};

export type ExhibitionWithDetails = Exhibition & {
  artists: Array<{
    id: string;
    name: string;
    picture_url: string | null;
  }>;
  artworks: Array<{
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    dimensions: string | null;
    listPriceDisplay: string | null;
    status: string;
  }>;
};

export async function getExhibitionsForGallery(
  galleryId: string,
  options?: { ownerRole?: 'gallery' | 'institution' },
): Promise<Exhibition[]> {
  const client = getSupabaseServerClient();

  let query = (client as any)
    .from('exhibitions')
    .select('*')
    .eq('gallery_id', galleryId)
    .order('start_date', { ascending: false });

  if (options?.ownerRole) {
    query = query.eq('owner_role', options.ownerRole);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Exhibitions] getExhibitionsForGallery failed', error);
    return [];
  }

  return data || [];
}

/**
 * Exhibitions where this artist is credited (exhibition_artists) or has verified works in the show (exhibition_artworks).
 */
export async function getExhibitionsForArtistAccount(
  artistAccountId: string,
  options?: { artistProfileId?: string | null },
): Promise<Exhibition[]> {
  const client = getSupabaseServerClient();
  const profileId = options?.artistProfileId ?? null;

  const byId = new Map<string, Exhibition>();

  const { data: creditedRows, error: creditedErr } = await (client as any)
    .from('exhibition_artists')
    .select(
      `
      exhibition_id,
      exhibitions!exhibition_artists_exhibition_id_fkey (
        id,
        gallery_id,
        title,
        description,
        start_date,
        end_date,
        location,
        image_url,
        owner_role,
        created_at,
        updated_at
      )
    `,
    )
    .eq('artist_account_id', artistAccountId);

  if (creditedErr) {
    console.error('[Exhibitions] getExhibitionsForArtistAccount exhibition_artists failed', creditedErr);
  }

  for (const row of creditedRows || []) {
    const ex = row.exhibitions as Exhibition | undefined;
    if (ex?.id) byId.set(ex.id, ex);
  }

  const orParts: string[] = [`artist_account_id.eq.${artistAccountId}`];
  if (profileId) {
    orParts.push(`artist_profile_id.eq.${profileId}`);
  }
  orParts.push(
    `and(account_id.eq.${artistAccountId},artist_account_id.is.null,artist_profile_id.is.null)`,
  );

  const { data: artworkRows, error: artworkErr } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('status', 'verified')
    .or(orParts.join(','));

  if (artworkErr) {
    console.error('[Exhibitions] getExhibitionsForArtistAccount artworks query failed', artworkErr);
  }

  const artworkIds = (artworkRows || []).map((a: { id: string }) => a.id).filter(Boolean);

  if (artworkIds.length > 0) {
    const { data: linkRows, error: linkErr } = await (client as any)
      .from('exhibition_artworks')
      .select(
        `
        exhibition_id,
        exhibitions!exhibition_artworks_exhibition_id_fkey (
          id,
          gallery_id,
          title,
          description,
          start_date,
          end_date,
          location,
          image_url,
          owner_role,
          created_at,
          updated_at
        )
      `,
      )
      .in('artwork_id', artworkIds);

    if (linkErr) {
      console.error('[Exhibitions] getExhibitionsForArtistAccount exhibition_artworks failed', linkErr);
    }

    for (const row of linkRows || []) {
      const ex = row.exhibitions as Exhibition | undefined;
      if (ex?.id) byId.set(ex.id, ex);
    }
  }

  const list = Array.from(byId.values());
  list.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  console.log('[Exhibitions] getExhibitionsForArtistAccount', {
    artistAccountId,
    count: list.length,
  });

  return list;
}

export async function getExhibitionWithDetails(
  exhibitionId: string,
  options?: { viewerUserId?: string | null },
): Promise<ExhibitionWithDetails | null> {
  const client = getSupabaseServerClient();

  // Get exhibition
  const { data: exhibition, error: exhibitionError } = await (client as any)
    .from('exhibitions')
    .select('*')
    .eq('id', exhibitionId)
    .single();

  if (exhibitionError || !exhibition) {
    return null;
  }

  // Get artists
  const { data: artists } = await (client as any)
    .from('exhibition_artists')
    .select(`
      artist_account_id,
      accounts!exhibition_artists_artist_account_id_fkey (
        id,
        name,
        picture_url
      )
    `)
    .eq('exhibition_id', exhibitionId);

  const viewerId = options?.viewerUserId ?? null;
  const canSeeDraftListings = !!viewerId && viewerId === exhibition.gallery_id;

  // Get artworks - fetch ONLY artworks linked to this specific exhibition
  const { data: artworks, error: artworksError } = await (client as any)
    .from('exhibition_artworks')
    .select(`
      artwork_id,
      exhibition_id,
      artworks!exhibition_artworks_artwork_id_fkey (
        id,
        title,
        description,
        image_url,
        status,
        is_public,
        dimensions,
        metadata
      )
    `)
    .eq('exhibition_id', exhibitionId); // Explicitly filter by this exhibition's ID

  if (artworksError) {
    console.error('Error fetching exhibition artworks:', artworksError);
  }

  // Double-check: filter out any artworks that don't belong to this exhibition
  // (defensive programming in case of data inconsistency)
  const filteredArtworks = (artworks || [])
    .filter((ea: any) => {
      // Ensure the exhibition_id matches (should always be true due to query, but double-check)
      if (ea.exhibition_id !== exhibitionId) {
        console.warn(`Artwork ${ea.artwork_id} has mismatched exhibition_id: ${ea.exhibition_id} vs ${exhibitionId}`);
        return false;
      }
      const row = ea.artworks;
      if (!row) return false;
      if (row.status === 'verified') return true;
      if (canSeeDraftListings && row.status === 'draft') return true;
      return false;
    })
    .map((ea: any) => {
      const a = ea.artworks;
      const meta =
        a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : {};
      const listPrice =
        typeof meta.exhibition_list_price === 'string' && meta.exhibition_list_price.trim()
          ? meta.exhibition_list_price.trim()
          : null;
      return {
        id: a.id,
        title: a.title,
        description: a.description ?? null,
        image_url: a.image_url,
        dimensions: a.dimensions ?? null,
        listPriceDisplay: listPrice,
        status: a.status,
      };
    });

  return {
    ...exhibition,
    artists: (artists || []).map((ea: any) => ({
      id: ea.accounts.id,
      name: ea.accounts.name,
      picture_url: ea.accounts.picture_url,
    })),
    artworks: filteredArtworks,
  };
}

