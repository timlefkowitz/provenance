import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import {
  expandChain,
  loadExhibitionCounts,
  loadLedgerSales,
  type ChainArtwork,
} from '~/lib/sales/load-chain-sales';
import { countDistinctSales, listPriceOf, type SaleDateRow } from '~/lib/sales/sale-money';
import { computeProvenanceValue, type ProvenanceValue } from '~/lib/valuation/provenance-value';

/**
 * One Provenance Value per physical work. A work's CoA, the show's CoS and the
 * buyer's CoO are separate rows linked by source_artwork_id; every one of them
 * gets the same value, built from the whole chain: the seller's price, every
 * show (a CoS alone counts as exhibited), every publication and every sale.
 */

export type ChainLedgerRow = SaleDateRow & { artwork_id: string; price_cents: number | null };

/** Pure — exported for tests. `rows` are the certificates of one work. */
export function computeChainProvenanceValue(params: {
  rows: ChainArtwork[];
  rootId: string;
  exhibitionCount: number;
  ledger: ChainLedgerRow[];
}): ProvenanceValue | null {
  const { rows, rootId } = params;
  const ordered = [...rows.filter((r) => r.id === rootId), ...rows.filter((r) => r.id !== rootId)];

  // A buyer's CoO value is the owner's own figure; use it only when no seller price exists.
  const sellerRows = ordered.filter((r) => r.certificate_type !== 'ownership');
  const value =
    sellerRows.map((r) => listPriceOf(r)).find(Boolean) ??
    ordered.map((r) => listPriceOf(r)).find(Boolean) ??
    null;

  const soldRows = rows.filter((r) => r.is_sold || r.sold_at).map((r) => ({ sold_at: r.sold_at ?? null }));
  const saleCount = countDistinctSales(params.ledger, soldRows);
  const salePriceCents =
    Math.max(0, ...rows.map((r) => r.sold_price_cents ?? 0), ...params.ledger.map((l) => l.price_cents ?? 0)) ||
    null;
  const publicationCount = Math.max(
    0,
    ...rows.map((r) => (Array.isArray(r.publications) ? r.publications.length : 0)),
  );

  return computeProvenanceValue({
    value,
    exhibitionCount: params.exhibitionCount,
    publicationCount,
    saleCount,
    sale: saleCount > 0 ? { priceCents: salePriceCents, currency: 'USD' } : null,
  });
}

/** Provenance Value for each requested id (same value for every id of one work). */
export async function loadChainProvenanceValues(
  admin: UntypedSupabaseClient,
  artworkIds: string[],
): Promise<Map<string, ProvenanceValue | null>> {
  const out = new Map<string, ProvenanceValue | null>();
  const requested = Array.from(new Set(artworkIds.filter(Boolean)));
  if (!requested.length) return out;

  try {
    const chain = await expandChain(admin, requested);
    const { workKeys } = chain;
    const keyOf = (id: string) => workKeys.get(id) ?? id;

    const [ledger, exhibitionCounts] = await Promise.all([
      loadLedgerSales(admin, chain.ids),
      loadExhibitionCounts(admin, chain.ids, workKeys, chain.rows),
    ]);

    const rowsByWork = new Map<string, ChainArtwork[]>();
    for (const r of chain.rows) rowsByWork.set(keyOf(r.id), [...(rowsByWork.get(keyOf(r.id)) ?? []), r]);
    const ledgerByWork = new Map<string, ChainLedgerRow[]>();
    for (const l of ledger) {
      ledgerByWork.set(keyOf(l.artwork_id), [...(ledgerByWork.get(keyOf(l.artwork_id)) ?? []), l]);
    }

    const byWork = new Map<string, ProvenanceValue | null>();
    for (const id of requested) {
      const key = keyOf(id);
      if (!byWork.has(key)) {
        byWork.set(
          key,
          computeChainProvenanceValue({
            rows: rowsByWork.get(key) ?? [],
            rootId: key,
            exhibitionCount: exhibitionCounts.get(key) ?? 0,
            ledger: ledgerByWork.get(key) ?? [],
          }),
        );
      }
      out.set(id, byWork.get(key) ?? null);
    }
  } catch (err) {
    console.error('[Valuation] loadChainProvenanceValues failed', err);
  }
  return out;
}

/** Provenance Value in cents per id, for money totals. */
export async function loadChainProvenanceValueCents(
  admin: UntypedSupabaseClient,
  artworkIds: string[],
): Promise<Map<string, number>> {
  const values = await loadChainProvenanceValues(admin, artworkIds);
  const cents = new Map<string, number>();
  for (const [id, pv] of values) if (pv) cents.set(id, Math.round(pv.total * 100));
  return cents;
}

/** Sets `provenance_value_cents` on each row (for the valueAt waterfall). Never throws. */
export async function attachProvenanceValues<T extends { id: string; provenance_value_cents?: number | null }>(
  admin: UntypedSupabaseClient,
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const cents = await loadChainProvenanceValueCents(admin, rows.map((r) => r.id));
  for (const r of rows) r.provenance_value_cents = cents.get(r.id) ?? null;
  return rows;
}
