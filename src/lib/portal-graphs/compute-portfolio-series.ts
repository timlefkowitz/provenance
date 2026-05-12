import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { PortfolioSeries, PortfolioPoint } from './types';
import { valueAt, type ArtworkValueRow, type ValuationRow } from './value-waterfall';

/**
 * Return a 12-month portfolio-value time series for a user.
 *
 * "Owned" at a given month-end means:
 *  - (account_id = userId AND created_at <= t AND (is_sold = false OR sold_at > t))  [uploaded, not yet sold]
 *  - (sold_to_account_id = userId AND sold_at <= t)                                  [acquired via sale]
 */
export async function computePortfolioSeries(
  userId: string,
  monthsBack = 12,
): Promise<PortfolioSeries> {
  console.log('[PortalGraphs] computePortfolioSeries started', { userId, monthsBack });

  const admin = getSupabaseServerAdminClient() as any;

  try {
    // Fetch all artworks owned (uploaded) by user — we'll filter by sold status per month
    const { data: uploadedRaw, error: uploadedErr } = await admin
      .from('artworks')
      .select('id, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, value')
      .eq('account_id', userId);

    if (uploadedErr) {
      console.error('[PortalGraphs] computePortfolioSeries uploadedRaw fetch failed', uploadedErr);
    }

    // Fetch artworks acquired (bought by user)
    const { data: acquiredRaw, error: acquiredErr } = await admin
      .from('artworks')
      .select('id, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, value')
      .eq('sold_to_account_id', userId);

    if (acquiredErr) {
      console.error('[PortalGraphs] computePortfolioSeries acquiredRaw fetch failed', acquiredErr);
    }

    // Merge, de-duplicate by id
    const artworkMap = new Map<string, ArtworkValueRow & { created_at: string; is_sold: boolean; sold_to_account_id: string | null }>();
    for (const row of [...(uploadedRaw ?? []), ...(acquiredRaw ?? [])]) {
      if (!artworkMap.has(row.id)) {
        artworkMap.set(row.id, row as any);
      }
    }
    const artworks = Array.from(artworkMap.values());

    // Fetch all valuations for these artworks in one query
    const artworkIds = artworks.map((a) => a.id);
    let valuationsByArtwork = new Map<string, ValuationRow[]>();

    if (artworkIds.length > 0) {
      const { data: valRows, error: valErr } = await admin
        .from('artwork_valuations')
        .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
        .in('artwork_id', artworkIds)
        .order('generated_at', { ascending: false });

      if (valErr) {
        console.error('[PortalGraphs] computePortfolioSeries valuation fetch failed', valErr);
      }

      for (const v of (valRows ?? []) as ValuationRow[]) {
        if (!valuationsByArtwork.has(v.artwork_id)) {
          valuationsByArtwork.set(v.artwork_id, []);
        }
        valuationsByArtwork.get(v.artwork_id)!.push(v);
      }
    }

    // Build month-end timestamps going back `monthsBack`
    const now = new Date();
    const monthEndPoints: Date[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of month (i months ago)
      monthEndPoints.push(d);
    }

    const series: PortfolioPoint[] = monthEndPoints.map((t) => {
      let totalValue = 0;
      let totalLow = 0;
      let totalHigh = 0;

      for (const artwork of artworks) {
        // Is artwork owned at time t?
        const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
        const soldAt = artwork.sold_at ? new Date(artwork.sold_at) : null;
        const boughtByUser = artwork.sold_to_account_id === userId;

        let owned = false;
        if (boughtByUser) {
          // acquired via sale — owned from soldAt onwards
          owned = soldAt != null && soldAt.getTime() <= t.getTime();
        } else {
          // uploaded — owned from createdAt, until sold (if sold)
          const existsAtT = createdAt != null && createdAt.getTime() <= t.getTime();
          const notSoldYet = !artwork.is_sold || (soldAt != null && soldAt.getTime() > t.getTime());
          owned = existsAtT && notSoldYet;
        }

        if (!owned) continue;

        const valuations = valuationsByArtwork.get(artwork.id) ?? [];
        const result = valueAt(artwork as ArtworkValueRow, valuations, t);
        totalValue += result.value_cents;
        totalLow += result.low_cents;
        totalHigh += result.high_cents;
      }

      const monthLabel = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
      return {
        month: monthLabel,
        value_cents: totalValue,
        low_cents: totalLow,
        high_cents: totalHigh,
      };
    });

    // Current snapshot (as of now)
    const currentT = new Date();
    let currentTotal = 0;
    let currentLow = 0;
    let currentHigh = 0;
    let valuationCoverage = 0;

    for (const artwork of artworks) {
      const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
      const soldAt = artwork.sold_at ? new Date(artwork.sold_at) : null;
      const boughtByUser = artwork.sold_to_account_id === userId;

      let owned = false;
      if (boughtByUser) {
        owned = soldAt != null && soldAt.getTime() <= currentT.getTime();
      } else {
        const existsAtT = createdAt != null && createdAt.getTime() <= currentT.getTime();
        const notSoldYet = !artwork.is_sold || (soldAt != null && soldAt.getTime() > currentT.getTime());
        owned = existsAtT && notSoldYet;
      }

      if (!owned) continue;

      const valuations = valuationsByArtwork.get(artwork.id) ?? [];
      const result = valueAt(artwork as ArtworkValueRow, valuations, currentT);
      currentTotal += result.value_cents;
      currentLow += result.low_cents;
      currentHigh += result.high_cents;
      if (result.fromValuation) valuationCoverage++;
    }

    const workCount = artworks.filter((a) => {
      const createdAt = a.created_at ? new Date(a.created_at) : null;
      const soldAt = a.sold_at ? new Date(a.sold_at) : null;
      const boughtByUser = a.sold_to_account_id === userId;
      if (boughtByUser) {
        return soldAt != null && soldAt.getTime() <= currentT.getTime();
      }
      const existsAtT = createdAt != null && createdAt.getTime() <= currentT.getTime();
      const notSoldYet = !a.is_sold || (soldAt != null && soldAt.getTime() > currentT.getTime());
      return existsAtT && notSoldYet;
    }).length;

    const result: PortfolioSeries = {
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

    return result;
  } catch (err) {
    console.error('[PortalGraphs] computePortfolioSeries failed', err);
    return {
      series: [],
      total_cents: 0,
      low_cents: 0,
      high_cents: 0,
      workCount: 0,
      valuationCoverage: 0,
    };
  }
}
