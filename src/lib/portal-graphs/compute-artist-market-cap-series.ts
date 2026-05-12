import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { PortfolioSeries, PortfolioPoint } from './types';
import { valueAt, type ArtworkValueRow, type ValuationRow } from './value-waterfall';

/**
 * Return a 12-month "market cap" time series for an artist.
 *
 * "Body of work" at a given month-end means all artworks where
 * artist_account_id = artistAccountId AND created_at <= t.
 *
 * Market cap = sum of best available value estimate per artwork.
 */
export async function computeArtistMarketCapSeries(
  artistAccountId: string,
  monthsBack = 12,
): Promise<PortfolioSeries> {
  console.log('[PortalGraphs] computeArtistMarketCapSeries started', { artistAccountId, monthsBack });

  const admin = getSupabaseServerAdminClient() as any;

  try {
    const { data: artworksRaw, error: artworksErr } = await admin
      .from('artworks')
      .select('id, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, value')
      .eq('artist_account_id', artistAccountId);

    if (artworksErr) {
      console.error('[PortalGraphs] computeArtistMarketCapSeries artworks fetch failed', artworksErr);
    }

    const artworks = (artworksRaw ?? []) as Array<
      ArtworkValueRow & { created_at: string; is_sold: boolean; sold_to_account_id: string | null }
    >;

    const artworkIds = artworks.map((a) => a.id);
    const valuationsByArtwork = new Map<string, ValuationRow[]>();

    if (artworkIds.length > 0) {
      const { data: valRows, error: valErr } = await admin
        .from('artwork_valuations')
        .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
        .in('artwork_id', artworkIds)
        .order('generated_at', { ascending: false });

      if (valErr) {
        console.error('[PortalGraphs] computeArtistMarketCapSeries valuation fetch failed', valErr);
      }

      for (const v of (valRows ?? []) as ValuationRow[]) {
        if (!valuationsByArtwork.has(v.artwork_id)) {
          valuationsByArtwork.set(v.artwork_id, []);
        }
        valuationsByArtwork.get(v.artwork_id)!.push(v);
      }
    }

    // Build month-end timestamps
    const now = new Date();
    const monthEndPoints: Date[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      monthEndPoints.push(d);
    }

    const series: PortfolioPoint[] = monthEndPoints.map((t) => {
      let totalValue = 0;
      let totalLow = 0;
      let totalHigh = 0;

      for (const artwork of artworks) {
        const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
        if (!createdAt || createdAt.getTime() > t.getTime()) continue;

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

    // Current snapshot
    const currentT = new Date();
    let currentTotal = 0;
    let currentLow = 0;
    let currentHigh = 0;
    let valuationCoverage = 0;

    for (const artwork of artworks) {
      const createdAt = artwork.created_at ? new Date(artwork.created_at) : null;
      if (!createdAt || createdAt.getTime() > currentT.getTime()) continue;

      const valuations = valuationsByArtwork.get(artwork.id) ?? [];
      const result = valueAt(artwork as ArtworkValueRow, valuations, currentT);
      currentTotal += result.value_cents;
      currentLow += result.low_cents;
      currentHigh += result.high_cents;
      if (result.fromValuation) valuationCoverage++;
    }

    const workCount = artworks.filter((a) => {
      const createdAt = a.created_at ? new Date(a.created_at) : null;
      return createdAt != null && createdAt.getTime() <= currentT.getTime();
    }).length;

    const result: PortfolioSeries = {
      series,
      total_cents: currentTotal,
      low_cents: currentLow,
      high_cents: currentHigh,
      workCount,
      valuationCoverage,
    };

    console.log('[PortalGraphs] computeArtistMarketCapSeries complete', {
      artistAccountId,
      total: currentTotal,
      points: series.length,
      workCount,
      valuationCoverage,
    });

    return result;
  } catch (err) {
    console.error('[PortalGraphs] computeArtistMarketCapSeries failed', err);
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
