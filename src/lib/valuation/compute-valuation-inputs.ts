import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { logger } from '~/lib/logger';

export const VALUATION_ENGINE_VERSION = 'v1';

export interface ValuationInputs {
  artwork_id: string;

  medium: string | null;
  condition: string | null;
  rarity_index: number;

  former_owners_count: number;
  notable_collectors_count: number;
  museum_count: number;

  artist_market_cap_cents: number;
  auction_history_summary: {
    high_cents: number;
    low_cents: number;
    median_cents: number;
    count: number;
  };
  museum_presence_count: number;

  exhibition_count: number;
  scholarly_citations_count: number;

  market_signals: {
    comparables: Array<{
      sale_id: string;
      price_cents: number | null;
      currency: string;
      sold_at: string;
    }>;
    same_medium_count: number;
    avg_comparable_cents: number;
  };

  deterministic_output: {
    estimated_value_cents: number;
    confidence_low_cents: number;
    confidence_high_cents: number;
    cultural_importance_score: number;
    liquidity_score: number;
    forgery_risk_score: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countLines(text: string | null | undefined): number {
  if (!text) return 0;
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

export type ValuationInputsResult =
  | { ok: true; inputs: ValuationInputs }
  | { ok: false; reason: string };

export async function computeValuationInputs(
  artworkId: string,
): Promise<ValuationInputsResult> {
  console.log('[Valuation] computeValuationInputs started', { artworkId });

  const admin = getSupabaseServerAdminClient();

  try {
    const { data: artwork, error: artworkError } = await (admin as any)
      .from('artworks')
      .select(
        'id, account_id, artist_account_id, medium, condition, former_owners, auction_history, exhibition_history, historic_context, celebrity_notes, edition, value',
      )
      .eq('id', artworkId)
      .maybeSingle();

    if (artworkError || !artwork) {
      const reason = artworkError
        ? `Artwork query failed: ${artworkError.message}`
        : `Artwork ${artworkId} not found`;
      console.error('[Valuation] artwork fetch failed', reason, artworkError);
      return { ok: false, reason };
    }

    const artistId = (artwork.artist_account_id as string | null) ?? null;
    const ownerId = (artwork.account_id as string | null) ?? null;

    const { data: artistStats } = artistId
      ? await (admin as any)
          .from('entity_stats')
          .select('*')
          .eq('entity_account_id', artistId)
          .eq('entity_role', 'artist')
          .maybeSingle()
      : { data: null as any };

    const { data: ownerStats } = ownerId
      ? await (admin as any)
          .from('entity_stats')
          .select('*')
          .eq('entity_account_id', ownerId)
          .maybeSingle()
      : { data: null as any };

    // Comparable sales for same artist
    let comparables: Array<any> = [];
    if (artistId) {
      const { data: artistArtworks } = await (admin as any)
        .from('artworks')
        .select('id')
        .eq('artist_account_id', artistId)
        .limit(200);
      const ids = Array.isArray(artistArtworks)
        ? (artistArtworks as Array<any>).map((a) => a.id as string)
        : [];
      if (ids.length) {
        const { data: sales } = await (admin as any)
          .from('sales_ledger')
          .select('id, artwork_id, price_cents, currency, sold_at')
          .in('artwork_id', ids)
          .order('sold_at', { ascending: false })
          .limit(20);
        comparables = Array.isArray(sales) ? (sales as Array<any>) : [];
      }
    }

    // Exhibition / museum counts from provenance_events for this work
    const { data: events } = await (admin as any)
      .from('provenance_events')
      .select('event_type, metadata')
      .eq('artwork_id', artworkId);
    const eventList = Array.isArray(events) ? (events as Array<any>) : [];
    const artworkExhibitionEventCount = eventList.filter(
      (e) => e.event_type === 'exhibition',
    ).length;
    const artworkMuseumEventCount = eventList.filter((e) => {
      if (e.event_type !== 'exhibition') return false;
      const venue = (e?.metadata?.venue_type as string) || '';
      return venue.toLowerCase().includes('museum');
    }).length;

    const formerOwnersCount = countLines(artwork.former_owners as string | null);

    const exhibitionTextCount = countLines(artwork.exhibition_history as string | null);
    const exhibitionCount = Math.max(artworkExhibitionEventCount, exhibitionTextCount);
    const museumPresenceCount = Math.max(
      artworkMuseumEventCount,
      Number(artistStats?.museum_exhibition_count ?? 0),
    );

    const notableCollectorsCount = (() => {
      const text = (artwork.former_owners as string | null) ?? '';
      return text
        .split(/\r?\n/)
        .filter((line) => /museum|foundation|estate|collection/i.test(line)).length;
    })();

    const auctionPrices = comparables
      .map((s) => (typeof s.price_cents === 'number' ? (s.price_cents as number) : 0))
      .filter((n) => n > 0);

    const sortedPrices = [...auctionPrices].sort((a, b) => a - b);
    const high = sortedPrices.length ? sortedPrices[sortedPrices.length - 1]! : 0;
    const low = sortedPrices.length ? sortedPrices[0]! : 0;
    const median = sortedPrices.length
      ? sortedPrices.length % 2 === 0
        ? Math.round((sortedPrices[sortedPrices.length / 2 - 1]! + sortedPrices[sortedPrices.length / 2]!) / 2)
        : sortedPrices[Math.floor(sortedPrices.length / 2)]!
      : 0;

    const avgComparable = auctionPrices.length
      ? Math.round(auctionPrices.reduce((a, b) => a + b, 0) / auctionPrices.length)
      : 0;

    const marketCap = Number(artistStats?.market_cap_cents ?? 0);
    const rarityIndex = Number(artistStats?.rarity_index ?? 0);
    const scholarlyCitations = Number(artistStats?.scholarly_citations_count ?? 0);

    // Deterministic estimate: weighted blend of median comparable, artist market cap per work, and owner-declared value.
    const declaredValueCents = (() => {
      const raw = (artwork.value as string | null) ?? '';
      const numeric = Number((raw.match(/[0-9.]+/) ?? ['0'])[0]);
      return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
    })();

    const perWorkMarketCap = (() => {
      const produced = Number(artistStats?.artworks_produced_count ?? 0);
      if (!produced) return 0;
      return Math.round(marketCap / Math.max(produced, 1));
    })();

    const candidates = [median, avgComparable, declaredValueCents, perWorkMarketCap].filter(
      (n) => n > 0,
    );
    const estimatedValue = candidates.length
      ? Math.round(candidates.reduce((a, b) => a + b, 0) / candidates.length)
      : 0;

    const spread = candidates.length > 1 ? Math.max(...candidates) - Math.min(...candidates) : 0;
    const confidenceLow = Math.max(0, Math.round(estimatedValue - spread / 2));
    const confidenceHigh = Math.round(estimatedValue + spread / 2);

    const culturalImportance = clamp(
      (exhibitionCount * 4) +
        (museumPresenceCount * 8) +
        (notableCollectorsCount * 6) +
        (scholarlyCitations * 3),
      0,
      100,
    );

    const liquidity = clamp(
      (auctionPrices.length * 10) +
        (Number(ownerStats?.total_sales_count ?? 0) * 2) +
        (marketCap > 0 ? 20 : 0),
      0,
      100,
    );

    const forgeryRisk = clamp(
      40 - formerOwnersCount * 5 - exhibitionCount * 2 - (museumPresenceCount > 0 ? 20 : 0),
      0,
      100,
    );

    const inputs: ValuationInputs = {
      artwork_id: artworkId,
      medium: (artwork.medium as string | null) ?? null,
      condition: (artwork.condition as string | null) ?? null,
      rarity_index: rarityIndex,

      former_owners_count: formerOwnersCount,
      notable_collectors_count: notableCollectorsCount,
      museum_count: museumPresenceCount,

      artist_market_cap_cents: marketCap,
      auction_history_summary: {
        high_cents: high,
        low_cents: low,
        median_cents: median,
        count: auctionPrices.length,
      },
      museum_presence_count: museumPresenceCount,

      exhibition_count: exhibitionCount,
      scholarly_citations_count: scholarlyCitations,

      market_signals: {
        comparables: comparables.map((c) => ({
          sale_id: c.id as string,
          price_cents: (c.price_cents as number | null) ?? null,
          currency: (c.currency as string) || 'USD',
          sold_at: c.sold_at as string,
        })),
        same_medium_count: comparables.length,
        avg_comparable_cents: avgComparable,
      },

      deterministic_output: {
        estimated_value_cents: estimatedValue,
        confidence_low_cents: confidenceLow,
        confidence_high_cents: confidenceHigh,
        cultural_importance_score: culturalImportance,
        liquidity_score: liquidity,
        forgery_risk_score: forgeryRisk,
      },
    };

    console.log('[Valuation] computeValuationInputs complete', {
      artworkId,
      comparables: comparables.length,
      estimatedValue,
    });

    return { ok: true, inputs };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[Valuation] computeValuationInputs failed', reason, err);
    logger.error('compute_valuation_inputs_failed', { artworkId, error: err });
    return { ok: false, reason: `Valuation engine error: ${reason}` };
  }
}
