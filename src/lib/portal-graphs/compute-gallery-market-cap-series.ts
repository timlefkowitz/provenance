import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { PortfolioSeries, PortfolioPoint } from './types';
import { valueAt, type ArtworkValueRow, type ValuationRow } from './value-waterfall';

const EMPTY_SERIES: PortfolioSeries = {
  series: [],
  total_cents: 0,
  low_cents: 0,
  high_cents: 0,
  workCount: 0,
  valuationCoverage: 0,
};

/**
 * Return a 12-month "market cap" time series for a gallery.
 *
 * "Roster" = all artworks where gallery_profile_id is in the given list.
 * No certificate_type filter — covers COA, COO, show, and any future types.
 */
export async function computeGalleryMarketCapSeries(
  galleryProfileIds: string[],
  monthsBack = 12,
): Promise<PortfolioSeries> {
  console.log('[PortalGraphs] computeGalleryMarketCapSeries started', { galleryProfileIds, monthsBack });

  if (!galleryProfileIds.length) {
    console.log('[PortalGraphs] computeGalleryMarketCapSeries short-circuit — no gallery profiles');
    return EMPTY_SERIES;
  }

  const admin = getSupabaseServerAdminClient() as any;

  try {
    const { data: artworkRows, error: artworkErr } = await admin
      .from('artworks')
      .select('id, created_at, is_sold, sold_at, sold_price_cents, sold_to_account_id, value')
      .in('gallery_profile_id', galleryProfileIds);

    if (artworkErr) {
      console.error('[PortalGraphs] computeGalleryMarketCapSeries artwork fetch failed', artworkErr);
    }

    const artworks = (artworkRows ?? []) as Array<
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
        console.error('[PortalGraphs] computeGalleryMarketCapSeries valuation fetch failed', valErr);
      }

      for (const v of (valRows ?? []) as ValuationRow[]) {
        if (!valuationsByArtwork.has(v.artwork_id)) valuationsByArtwork.set(v.artwork_id, []);
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
      return { month: monthLabel, value_cents: totalValue, low_cents: totalLow, high_cents: totalHigh };
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

    console.log('[PortalGraphs] computeGalleryMarketCapSeries complete', {
      galleryProfileIds,
      total: currentTotal,
      points: series.length,
      workCount,
      valuationCoverage,
    });

    return result;
  } catch (err) {
    console.error('[PortalGraphs] computeGalleryMarketCapSeries failed', err);
    return EMPTY_SERIES;
  }
}
