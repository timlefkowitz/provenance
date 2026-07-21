/**
 * Shared helper: fetch artworks eligible to appear on a creator site.
 *
 * Role-based ownership mirrors the site loader logic:
 *   - gallery  → gallery_profile_id = profile.id (catches all team COS)
 *   - artist   → artist_account_id / artist_profile_id / legacy account_id
 *   - other    → artist_account_id / legacy account_id
 *
 * Always filters status='verified', is_public=true.
 * Certificate-type filter is applied when 1 or 2 types are selected (all 3 = no filter).
 */

import type { SiteArtworkFilters } from '~/app/_sites/types';

type EligibleArtworkRow = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  certificate_type: string;
  for_sale?: boolean;
  sale_price?: number | null;
  sale_currency?: string | null;
  sold_at?: string | null;
  description?: string | null;
  dimensions?: string | null;
  inquire_enabled?: boolean;
  stripe_price_id?: string | null;
  account_id?: string | null;
};

type ProfileRef = {
  user_id: string;
  id: string;
  role: string;
};

export async function getEligibleSiteArtworks(
  sb: any,
  profile: ProfileRef,
  filters: SiteArtworkFilters,
  limit = 24,
): Promise<EligibleArtworkRow[]> {
  let q = sb
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, created_at, certificate_number, certificate_type, for_sale, sale_price, sale_currency, sold_at, description, dimensions, inquire_enabled, stripe_price_id, account_id',
    )
    .eq('status', 'verified')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (profile.role === 'gallery') {
    q = q.eq('gallery_profile_id', profile.id);
  } else if (profile.role === 'artist') {
    q = q.or(
      [
        `artist_account_id.eq.${profile.user_id}`,
        `artist_profile_id.eq.${profile.id}`,
        `and(account_id.eq.${profile.user_id},artist_account_id.is.null,artist_profile_id.is.null)`,
      ].join(','),
    );
  } else {
    q = q.or(
      [
        `artist_account_id.eq.${profile.user_id}`,
        `and(account_id.eq.${profile.user_id},artist_account_id.is.null)`,
      ].join(','),
    );
  }

  const allowedTypes = filters.certificate_types ?? [];
  if (allowedTypes.length > 0 && allowedTypes.length < 3) {
    q = q.in('certificate_type', allowedTypes);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[Sites] getEligibleSiteArtworks failed', error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch specific artworks by id (for curated/featured mode).
 * Still enforces status=verified and is_public=true.
 * Returns rows in the order of the provided ids array.
 */
export async function getFeaturedSiteArtworks(
  sb: any,
  ids: string[],
): Promise<EligibleArtworkRow[]> {
  if (!ids.length) return [];

  const { data, error } = await sb
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, created_at, certificate_number, certificate_type, for_sale, sale_price, sale_currency, sold_at, description, dimensions, inquire_enabled, stripe_price_id, account_id',
    )
    .in('id', ids)
    .eq('status', 'verified')
    .eq('is_public', true);

  if (error) {
    console.error('[Sites] getFeaturedSiteArtworks failed', error);
    return [];
  }

  const rows: EligibleArtworkRow[] = data ?? [];
  // Re-order to match the pinned order
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (idIndex.get(a.id) ?? 999) - (idIndex.get(b.id) ?? 999));
  return rows;
}
