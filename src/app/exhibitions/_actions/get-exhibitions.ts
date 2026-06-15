'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';

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
  published_at: string | null;
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
    artist_name: string | null;
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
        published_at,
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
          published_at,
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
  console.log('[Exhibitions] getExhibitionWithDetails started', { exhibitionId });
  const client = getSupabaseServerClient();

  // Get exhibition
  const { data: exhibition, error: exhibitionError } = await (client as any)
    .from('exhibitions')
    .select('*')
    .eq('id', exhibitionId)
    .single();

  if (exhibitionError || !exhibition) {
    console.error('[Exhibitions] getExhibitionWithDetails: exhibition not found', exhibitionError);
    return null;
  }

  const viewerId = options?.viewerUserId ?? null;
  const canManage =
    !!viewerId && (await canManageExhibition(viewerId, exhibition.gallery_id));

  if (!exhibition.published_at && !canManage) {
    console.log('[Exhibitions] getExhibitionWithDetails: unpublished and viewer cannot manage', {
      exhibitionId,
    });
    return null;
  }

  const canSeeDraftListings = canManage;

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
  const { data: artworkLinks, error: linksError } = await (client as any)
    .from('exhibition_artworks')
    .select('artwork_id, exhibition_id')
    .eq('exhibition_id', exhibitionId);

  if (linksError) {
    console.error('[Exhibitions] getExhibitionWithDetails: artwork links fetch failed', linksError);
  }

  const linkedArtworkIds = (artworkLinks || []).map((l: { artwork_id: string }) => l.artwork_id).filter(Boolean);
  const linkOrder = new Map<string, number>(linkedArtworkIds.map((id: string, i: number) => [id, i]));

  let rawArtworkRows: Array<Record<string, unknown>> = [];
  if (linkedArtworkIds.length > 0) {
    const { data: rows, error: artworksError } = await (client as any)
      .from('artworks')
      .select(`
        id,
        title,
        artist_name,
        artist_account_id,
        artist_profile_id,
        description,
        image_url,
        status,
        is_public,
        dimensions,
        metadata
      `)
      .in('id', linkedArtworkIds);

    if (artworksError) {
      console.error('[Exhibitions] getExhibitionWithDetails: artworks fetch failed', artworksError);
    }
    rawArtworkRows = rows || [];
  }

  console.log('[Exhibitions] raw artwork artist_names', rawArtworkRows.slice(0, 10).map((a) => ({
    id: a.id,
    title: a.title,
    artist_name: a.artist_name,
    artist_account_id: a.artist_account_id,
    artist_profile_id: a.artist_profile_id,
  })));

  // Resolve artist names from linked accounts / profiles when artist_name is empty
  const missingNameAccountIds = Array.from(
    new Set(
      rawArtworkRows
        .filter((a) => !String(a.artist_name ?? '').trim() && a.artist_account_id)
        .map((a) => a.artist_account_id as string),
    ),
  );
  const missingNameProfileIds = Array.from(
    new Set(
      rawArtworkRows
        .filter((a) => !String(a.artist_name ?? '').trim() && a.artist_profile_id)
        .map((a) => a.artist_profile_id as string),
    ),
  );

  const accountNameMap = new Map<string, string>();
  if (missingNameAccountIds.length > 0) {
    console.log('[Exhibitions] resolving artist names from accounts', { count: missingNameAccountIds.length });
    const { data: accountRows, error: accountErr } = await (client as any)
      .from('accounts')
      .select('id, name')
      .in('id', missingNameAccountIds);
    if (accountErr) {
      console.error('[Exhibitions] failed to resolve artist account names', accountErr);
    }
    for (const row of accountRows || []) {
      if (row.id && row.name) accountNameMap.set(row.id, row.name);
    }
    console.log('[Exhibitions] resolved artist account names', { resolved: accountNameMap.size });
  }

  const profileNameMap = new Map<string, string>();
  if (missingNameProfileIds.length > 0) {
    console.log('[Exhibitions] resolving artist names from profiles', { count: missingNameProfileIds.length });
    const { data: profileRows, error: profileErr } = await (client as any)
      .from('user_profiles')
      .select('id, name')
      .in('id', missingNameProfileIds);
    if (profileErr) {
      console.error('[Exhibitions] failed to resolve artist profile names', profileErr);
    }
    for (const row of profileRows || []) {
      if (row.id && row.name) profileNameMap.set(row.id, row.name);
    }
    console.log('[Exhibitions] resolved artist profile names', { resolved: profileNameMap.size });
  }

  const filteredArtworks = rawArtworkRows
    .filter((row) => {
      if (row.status === 'verified') return true;
      if (canSeeDraftListings && row.status === 'draft') return true;
      return false;
    })
    .sort((a, b) => (linkOrder.get(a.id as string) ?? 0) - (linkOrder.get(b.id as string) ?? 0))
    .map((a) => {
      const meta =
        a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : {};
      const listPrice =
        typeof meta.exhibition_list_price === 'string' && meta.exhibition_list_price.trim()
          ? meta.exhibition_list_price.trim()
          : null;
      const rawArtistName =
        typeof a.artist_name === 'string' && a.artist_name.trim() ? a.artist_name.trim() : null;
      const resolvedArtistName =
        rawArtistName ??
        (a.artist_account_id ? (accountNameMap.get(a.artist_account_id as string) ?? null) : null) ??
        (a.artist_profile_id ? (profileNameMap.get(a.artist_profile_id as string) ?? null) : null);
      return {
        id: a.id as string,
        title: a.title as string,
        artist_name: resolvedArtistName,
        description: (a.description as string | null) ?? null,
        image_url: a.image_url as string | null,
        dimensions: (a.dimensions as string | null) ?? null,
        listPriceDisplay: listPrice,
        status: a.status as string,
      };
    });

  const withArtistName = filteredArtworks.filter((a) => Boolean(a.artist_name?.trim())).length;
  const missingArtistName = filteredArtworks.length - withArtistName;
  console.log('[Exhibitions] getExhibitionWithDetails completed', {
    exhibitionId,
    linkedCount: linkedArtworkIds.length,
    visibleCount: filteredArtworks.length,
    withArtistName,
    missingArtistName,
    canSeeDraftListings,
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

