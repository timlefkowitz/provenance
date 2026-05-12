import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { PortfolioSeries, PortfolioPoint } from './types';
import { valueAt, type ArtworkValueRow, type ValuationRow } from './value-waterfall';

/**
 * Certificate types that represent genuine collection ownership.
 * 'show' (gallery exhibition certificates) is intentionally excluded.
 */
const COLLECTION_CERT_TYPES = ['authenticity', 'ownership'];

const SELECT_COLS =
  'id, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, account_id, artist_account_id, certificate_type, value';

type ArtworkRow = ArtworkValueRow & {
  created_at: string;
  is_sold: boolean;
  sold_to_account_id: string | null;
  account_id: string | null;
  artist_account_id: string | null;
  certificate_type: string | null;
};

/**
 * Determine whether a piece is "owned" by userId at timestamp t.
 *
 * Three ownership paths:
 *  1. Acquired via recorded sale (sold_to_account_id = me, sold_at <= t)
 *  2. Uploaded to the platform (account_id = me, created_at <= t, not sold away)
 *  3. COA-credited artist (artist_account_id = me, created_at <= t, not sold away)
 */
function isOwnedAtTime(artwork: ArtworkRow, userId: string, t: Date): boolean {
  const tMs = t.getTime();
  const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
  const soldAt = artwork.sold_at ? new Date(artwork.sold_at) : null;

  const isMyAcquisition = artwork.sold_to_account_id === userId;
  const isMyUpload = artwork.account_id === userId;
  const isMyCOA = artwork.artist_account_id === userId;

  if (isMyAcquisition) {
    // Owned from soldAt onwards
    return soldAt != null && soldAt.getTime() <= tMs;
  }

  if (isMyUpload || isMyCOA) {
    const existsAtT = createdAt != null && createdAt.getTime() <= tMs;
    // Sold away = sold to someone other than me, before or at t
    const soldAway =
      artwork.is_sold &&
      artwork.sold_to_account_id !== userId &&
      soldAt != null &&
      soldAt.getTime() <= tMs;
    return existsAtT && !soldAway;
  }

  return false;
}

/**
 * Return a 12-month portfolio-value time series for a user.
 *
 * "Collection" = all artworks the user holds a COA (authenticity) or
 * COO (ownership) certificate for. Three ownership paths are checked:
 *   - uploaded as account owner
 *   - credited as artist (artist_account_id)
 *   - acquired via recorded platform sale
 *
 * Per-artwork value uses the declared artwork.value field as a base,
 * upgraded by any formal artwork_valuations row.
 */
export async function computePortfolioSeries(
  userId: string,
  monthsBack = 12,
): Promise<PortfolioSeries> {
  console.log('[PortalGraphs] computePortfolioSeries started', { userId, monthsBack });

  const admin = getSupabaseServerAdminClient() as any;

  try {
    // Three parallel fetches covering all ownership paths, filtered to COA/COO only
    const [byOwner, byAcquired, byArtist] = await Promise.all([
      admin
        .from('artworks')
        .select(SELECT_COLS)
        .eq('account_id', userId)
        .in('certificate_type', COLLECTION_CERT_TYPES),
      admin
        .from('artworks')
        .select(SELECT_COLS)
        .eq('sold_to_account_id', userId)
        .in('certificate_type', COLLECTION_CERT_TYPES),
      admin
        .from('artworks')
        .select(SELECT_COLS)
        .eq('artist_account_id', userId)
        .in('certificate_type', COLLECTION_CERT_TYPES),
    ]);

    if (byOwner.error) console.error('[PortalGraphs] computePortfolioSeries byOwner failed', byOwner.error);
    if (byAcquired.error) console.error('[PortalGraphs] computePortfolioSeries byAcquired failed', byAcquired.error);
    if (byArtist.error) console.error('[PortalGraphs] computePortfolioSeries byArtist failed', byArtist.error);

    // De-duplicate by id
    const artworkMap = new Map<string, ArtworkRow>();
    for (const row of [
      ...(byOwner.data ?? []),
      ...(byAcquired.data ?? []),
      ...(byArtist.data ?? []),
    ]) {
      if (!artworkMap.has(row.id)) artworkMap.set(row.id, row as ArtworkRow);
    }
    const artworks = Array.from(artworkMap.values());

    // Fetch all valuations for these artworks
    const artworkIds = artworks.map((a) => a.id);
    const valuationsByArtwork = new Map<string, ValuationRow[]>();

    if (artworkIds.length > 0) {
      const { data: valRows, error: valErr } = await admin
        .from('artwork_valuations')
        .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
        .in('artwork_id', artworkIds)
        .order('generated_at', { ascending: false });

      if (valErr) console.error('[PortalGraphs] computePortfolioSeries valuation fetch failed', valErr);

      for (const v of (valRows ?? []) as ValuationRow[]) {
        if (!valuationsByArtwork.has(v.artwork_id)) valuationsByArtwork.set(v.artwork_id, []);
        valuationsByArtwork.get(v.artwork_id)!.push(v);
      }
    }

    // Build month-end timestamps going back `monthsBack`
    const now = new Date();
    const monthEndPoints: Date[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      // last day of the month (i months ago)
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      monthEndPoints.push(d);
    }

    const series: PortfolioPoint[] = monthEndPoints.map((t) => {
      let totalValue = 0;
      let totalLow = 0;
      let totalHigh = 0;

      for (const artwork of artworks) {
        if (!isOwnedAtTime(artwork, userId, t)) continue;
        const valuations = valuationsByArtwork.get(artwork.id) ?? [];
        const result = valueAt(artwork as ArtworkValueRow, valuations, t);
        totalValue += result.value_cents;
        totalLow += result.low_cents;
        totalHigh += result.high_cents;
      }

      const monthLabel = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
      return { month: monthLabel, value_cents: totalValue, low_cents: totalLow, high_cents: totalHigh };
    });

    // Current snapshot
    const currentT = new Date();
    let currentTotal = 0;
    let currentLow = 0;
    let currentHigh = 0;
    let valuationCoverage = 0;
    let workCount = 0;

    for (const artwork of artworks) {
      if (!isOwnedAtTime(artwork, userId, currentT)) continue;
      workCount++;
      const valuations = valuationsByArtwork.get(artwork.id) ?? [];
      const result = valueAt(artwork as ArtworkValueRow, valuations, currentT);
      currentTotal += result.value_cents;
      currentLow += result.low_cents;
      currentHigh += result.high_cents;
      if (result.fromValuation) valuationCoverage++;
    }

    const portfolioResult: PortfolioSeries = {
      series,
      total_cents: currentTotal,
      low_cents: currentLow,
      high_cents: currentHigh,
      workCount,
      valuationCoverage,
    };

    console.log('[PortalGraphs] computePortfolioSeries complete', {
      userId,
      total: currentTotal,
      points: series.length,
      workCount,
      valuationCoverage,
    });

    return portfolioResult;
  } catch (err) {
    console.error('[PortalGraphs] computePortfolioSeries failed', err);
    return { series: [], total_cents: 0, low_cents: 0, high_cents: 0, workCount: 0, valuationCoverage: 0 };
  }
}
