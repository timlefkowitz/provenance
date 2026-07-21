/**
 * Shared helper: fetch exhibitions eligible to appear on a creator site.
 *
 * Only gallery profiles own exhibitions (gallery_id = profile.user_id).
 * Always filters published_at not null.
 */

export type EligibleExhibitionRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
};

type ProfileRef = {
  user_id: string;
  role: string;
};

/**
 * Fetch up to `limit` published exhibitions for a gallery profile.
 * For non-gallery profiles returns an empty array.
 */
export async function getEligibleSiteExhibitions(
  sb: any,
  profile: ProfileRef,
  limit = 24,
): Promise<EligibleExhibitionRow[]> {
  if (profile.role !== 'gallery') return [];

  const { data, error } = await sb
    .from('exhibitions')
    .select('id, title, start_date, end_date, location, image_url')
    .eq('gallery_id', profile.user_id)
    .not('published_at', 'is', null)
    .order('start_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Sites] getEligibleSiteExhibitions failed', error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch specific exhibitions by id (for curated/featured mode).
 * Still enforces published_at not null.
 * Returns rows in the order of the provided ids array.
 */
export async function getFeaturedSiteExhibitions(
  sb: any,
  ids: string[],
): Promise<EligibleExhibitionRow[]> {
  if (!ids.length) return [];

  const { data, error } = await sb
    .from('exhibitions')
    .select('id, title, start_date, end_date, location, image_url')
    .in('id', ids)
    .not('published_at', 'is', null);

  if (error) {
    console.error('[Sites] getFeaturedSiteExhibitions failed', error);
    return [];
  }

  const rows: EligibleExhibitionRow[] = data ?? [];
  // Re-order to match the pinned order
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (idIndex.get(a.id) ?? 999) - (idIndex.get(b.id) ?? 999));
  return rows;
}
