import { computeProvenanceValue, parseArtworkPrice } from '~/lib/valuation/provenance-value';

/**
 * What a sale is worth for money statistics. A sale's own price wins; a sale
 * recorded without one (a Certificate of Ownership never asks) is counted at
 * the work's set value and flagged as estimated. Pure — no database.
 */

export type SaleMoneyBasis = 'recorded' | 'chain_recorded' | 'value' | 'none';

export interface SaleMoney {
  cents: number;
  basis: SaleMoneyBasis;
  /** True when the amount is the set value rather than a recorded price. */
  estimated: boolean;
}

/** The set value a show lists: the exhibition list price, else the artist's value. */
export function listPriceOf(artwork: {
  value?: string | null;
  metadata?: unknown;
}): string | null {
  const meta = (artwork.metadata ?? {}) as Record<string, unknown>;
  const list = meta.exhibition_list_price;
  if (typeof list === 'string' && list.trim()) return list.trim();
  if (typeof list === 'number' && Number.isFinite(list) && list > 0) return String(list);
  return artwork.value?.trim() || null;
}

/** The set value in cents, or null when it isn't a single price ("NFS", a range). */
export function setValueCents(artwork: { value?: string | null; metadata?: unknown }): number | null {
  const parsed = parseArtworkPrice(listPriceOf(artwork));
  return parsed ? Math.round(parsed.amount * 100) : null;
}

export function resolveSaleMoney(input: {
  priceCents: number | null | undefined;
  /** A price recorded on another certificate of the same work. */
  chainSoldPriceCents?: number | null;
  setValueCents?: number | null;
}): SaleMoney {
  if (input.priceCents && input.priceCents > 0) {
    return { cents: input.priceCents, basis: 'recorded', estimated: false };
  }
  if (input.chainSoldPriceCents && input.chainSoldPriceCents > 0) {
    return { cents: input.chainSoldPriceCents, basis: 'chain_recorded', estimated: false };
  }
  if (input.setValueCents && input.setValueCents > 0) {
    return { cents: input.setValueCents, basis: 'value', estimated: true };
  }
  return { cents: 0, basis: 'none', estimated: false };
}

/** Provenance Value in cents for a sold work: set value plus its documented-history premiums. */
export function provenanceValueCents(input: {
  value: string | null;
  exhibitionCount: number;
  publicationCount: number;
  saleCount: number;
  /** Used as the base when the work has no set value. */
  salePriceCents?: number | null;
}): number | null {
  const pv = computeProvenanceValue({
    value: input.value,
    exhibitionCount: input.exhibitionCount,
    publicationCount: input.publicationCount,
    saleCount: input.saleCount,
    sale: input.saleCount > 0 ? { priceCents: input.salePriceCents ?? null, currency: 'USD' } : null,
  });
  return pv ? Math.round(pv.total * 100) : null;
}

/**
 * One sale per work per day: the same sale saved twice, or recorded on both
 * the artist's CoA and the show's CoS. Keeps a priced row, else the first.
 */
export function dedupeSameDaySales<
  T extends { artwork_id: string; sold_at: string; price_cents: number | null },
>(rows: T[], workKeys: Map<string, string>): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${workKeys.get(row.artwork_id) ?? row.artwork_id}|${row.sold_at.slice(0, 10)}`;
    const kept = byKey.get(key);
    if (!kept || (!(kept.price_cents && kept.price_cents > 0) && row.price_cents && row.price_cents > 0)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

export type SaleDateRow = { sold_at: string | null };

/**
 * Distinct sales of one work. Rows on the same day are one sale (a sale
 * recorded on both the CoA and the show's CoS, or saved twice). Pure —
 * exported for tests.
 */
export function countDistinctSales(ledger: SaleDateRow[], soldCertificates: SaleDateRow[]): number {
  const days = new Set<string>();
  for (const row of ledger) days.add(row.sold_at ? row.sold_at.slice(0, 10) : 'undated');
  for (const row of soldCertificates) {
    const day = row.sold_at ? row.sold_at.slice(0, 10) : null;
    // A certificate marked sold with no ledger row on that day is a sale too.
    if (day ? !days.has(day) : days.size === 0) days.add(day ?? 'undated');
  }
  return days.size;
}
