import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { valueAt, type ArtworkValueRow, type ValuationRow, type ValueResult } from './value-waterfall';

const COLLECTION_CERT_TYPES = ['ownership'];

const SELECT_COLS =
  'id, title, artist_name, image_url, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, account_id, artist_account_id, certificate_type, value';

export interface BreakdownRow {
  artwork_id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  certificate_type: string | null;
  current_value: ValueResult;
}

type RawArtworkRow = ArtworkValueRow & {
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  is_sold: boolean;
  sold_to_account_id: string | null;
  account_id: string | null;
  artist_account_id: string | null;
  certificate_type: string | null;
};

function isCurrentlyOwned(artwork: RawArtworkRow, userId: string): boolean {
  const now = new Date();
  const nowMs = now.getTime();
  const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
  const soldAt = artwork.sold_at ? new Date(artwork.sold_at) : null;

  const isMyAcquisition = artwork.sold_to_account_id === userId;
  const isMyUpload = artwork.account_id === userId;
  const isMyCOA = artwork.artist_account_id === userId;

  if (isMyAcquisition) {
    return soldAt != null && soldAt.getTime() <= nowMs;
  }

  if (isMyUpload || isMyCOA) {
    const existsNow = createdAt != null && createdAt.getTime() <= nowMs;
    const soldAway =
      artwork.is_sold &&
      artwork.sold_to_account_id !== userId &&
      soldAt != null &&
      soldAt.getTime() <= nowMs;
    return existsNow && !soldAway;
  }

  return false;
}

async function fetchValuationMap(
  admin: any,
  artworkIds: string[],
): Promise<Map<string, ValuationRow[]>> {
  const map = new Map<string, ValuationRow[]>();
  if (!artworkIds.length) return map;

  const { data, error } = await admin
    .from('artwork_valuations')
    .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
    .in('artwork_id', artworkIds)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('[PortalGraphs] fetchValuationMap failed', error);
    return map;
  }

  for (const v of (data ?? []) as ValuationRow[]) {
    if (!map.has(v.artwork_id)) map.set(v.artwork_id, []);
    map.get(v.artwork_id)!.push(v);
  }

  return map;
}

function toBreakdownRow(artwork: RawArtworkRow, valuations: ValuationRow[]): BreakdownRow {
  return {
    artwork_id: artwork.id,
    title: artwork.title,
    artist_name: artwork.artist_name,
    image_url: artwork.image_url,
    certificate_type: artwork.certificate_type,
    current_value: valueAt(artwork as ArtworkValueRow, valuations, new Date()),
  };
}

/**
 * Return the current per-artwork breakdown for a user's collection
 * (COA + COO certificates they own, sorted by value descending).
 */
export async function loadCollectionBreakdown(userId: string): Promise<BreakdownRow[]> {
  console.log('[PortalGraphs] loadCollectionBreakdown started', { userId });

  const admin = getSupabaseServerAdminClient() as any;

  try {
    const [byOwner, byAcquired, byArtist] = await Promise.all([
      admin.from('artworks').select(SELECT_COLS).eq('account_id', userId).in('certificate_type', COLLECTION_CERT_TYPES),
      admin.from('artworks').select(SELECT_COLS).eq('sold_to_account_id', userId).in('certificate_type', COLLECTION_CERT_TYPES),
      admin.from('artworks').select(SELECT_COLS).eq('artist_account_id', userId).in('certificate_type', COLLECTION_CERT_TYPES),
    ]);

    if (byOwner.error) console.error('[PortalGraphs] loadCollectionBreakdown byOwner failed', byOwner.error);
    if (byAcquired.error) console.error('[PortalGraphs] loadCollectionBreakdown byAcquired failed', byAcquired.error);
    if (byArtist.error) console.error('[PortalGraphs] loadCollectionBreakdown byArtist failed', byArtist.error);

    const artworkMap = new Map<string, RawArtworkRow>();
    for (const row of [...(byOwner.data ?? []), ...(byAcquired.data ?? []), ...(byArtist.data ?? [])]) {
      if (!artworkMap.has(row.id)) artworkMap.set(row.id, row as RawArtworkRow);
    }

    const ownedNow = Array.from(artworkMap.values()).filter((a) => isCurrentlyOwned(a, userId));
    const valuationMap = await fetchValuationMap(admin, ownedNow.map((a) => a.id));

    const rows = ownedNow
      .map((a) => toBreakdownRow(a, valuationMap.get(a.id) ?? []))
      .sort((a, b) => b.current_value.value_cents - a.current_value.value_cents);

    console.log('[PortalGraphs] loadCollectionBreakdown complete', { userId, count: rows.length });
    return rows;
  } catch (err) {
    console.error('[PortalGraphs] loadCollectionBreakdown failed', err);
    return [];
  }
}

/**
 * Return the current per-artwork breakdown for a gallery's roster,
 * sorted by value descending. No certificate_type filter.
 */
export async function loadGalleryBreakdown(galleryProfileIds: string[]): Promise<BreakdownRow[]> {
  console.log('[PortalGraphs] loadGalleryBreakdown started', { galleryProfileIds });

  if (!galleryProfileIds.length) return [];

  const admin = getSupabaseServerAdminClient() as any;

  try {
    const { data, error } = await admin
      .from('artworks')
      .select(SELECT_COLS)
      .in('gallery_profile_id', galleryProfileIds);

    if (error) console.error('[PortalGraphs] loadGalleryBreakdown fetch failed', error);

    const artworks = (data ?? []) as RawArtworkRow[];
    const valuationMap = await fetchValuationMap(admin, artworks.map((a) => a.id));

    const rows = artworks
      .map((a) => toBreakdownRow(a, valuationMap.get(a.id) ?? []))
      .sort((a, b) => b.current_value.value_cents - a.current_value.value_cents);

    console.log('[PortalGraphs] loadGalleryBreakdown complete', { count: rows.length });
    return rows;
  } catch (err) {
    console.error('[PortalGraphs] loadGalleryBreakdown failed', err);
    return [];
  }
}

/**
 * Return the current per-artwork breakdown for an artist's body of work,
 * sorted by value descending.
 */
export async function loadArtistBreakdown(artistAccountId: string): Promise<BreakdownRow[]> {
  console.log('[PortalGraphs] loadArtistBreakdown started', { artistAccountId });

  const admin = getSupabaseServerAdminClient() as any;

  try {
    const [byArtistId, byAccountId] = await Promise.all([
      admin.from('artworks').select(SELECT_COLS).eq('artist_account_id', artistAccountId).eq('certificate_type', 'authenticity'),
      admin.from('artworks').select(SELECT_COLS).eq('account_id', artistAccountId).eq('certificate_type', 'authenticity'),
    ]);

    if (byArtistId.error) console.error('[PortalGraphs] loadArtistBreakdown byArtistId failed', byArtistId.error);
    if (byAccountId.error) console.error('[PortalGraphs] loadArtistBreakdown byAccountId failed', byAccountId.error);

    const artworkMap = new Map<string, RawArtworkRow>();
    for (const row of [...(byArtistId.data ?? []), ...(byAccountId.data ?? [])]) {
      if (!artworkMap.has(row.id)) artworkMap.set(row.id, row as RawArtworkRow);
    }

    const allWorks = Array.from(artworkMap.values());
    const valuationMap = await fetchValuationMap(admin, allWorks.map((a) => a.id));

    const rows = allWorks
      .map((a) => toBreakdownRow(a, valuationMap.get(a.id) ?? []))
      .sort((a, b) => b.current_value.value_cents - a.current_value.value_cents);

    console.log('[PortalGraphs] loadArtistBreakdown complete', { artistAccountId, count: rows.length });
    return rows;
  } catch (err) {
    console.error('[PortalGraphs] loadArtistBreakdown failed', err);
    return [];
  }
}
