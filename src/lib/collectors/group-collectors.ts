/**
 * Pure grouping logic for a gallery's collectors and exhibition sell-through.
 * Loaders in this folder fetch rows; everything here is deterministic so it
 * can be unit tested without a database.
 */

import type { SaleMoney } from '~/lib/sales/sale-money';

export interface SaleRow {
  /** Ledger id, or `artwork:<id>` for a sale only recorded on the artwork row. */
  id: string;
  artwork_id: string;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
  price_cents: number | null;
  sold_at: string;
  /** Set by priceSales: recorded price, else the work's set value (estimated). */
  money?: SaleMoney;
  /** Set by priceSales: the work's Provenance Value at the time of reporting. */
  provenance_value_cents?: number | null;
}

/** What a sale counts for in money totals. */
export function saleAmountCents(sale: Pick<SaleRow, 'money' | 'price_cents'>): number {
  return sale.money ? sale.money.cents : (sale.price_cents ?? 0);
}

function isEstimated(sale: Pick<SaleRow, 'money'>): boolean {
  return sale.money?.estimated ?? false;
}

export interface ArtworkLinkRow {
  id: string;
  source_artwork_id: string | null;
}

export interface ShownLink {
  exhibition_id: string;
  artwork_id: string;
}

export interface CollectorSummary {
  key: string;
  accountId: string | null;
  email: string | null;
  name: string | null;
  purchaseCount: number;
  /** Recorded prices plus set values for unpriced sales. */
  totalSpentCents: number;
  /** The part of totalSpentCents that is set value, not a recorded price. */
  estimatedSpentCents: number;
  currentValueCents: number;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  exhibitionIds: string[];
  artworkIds: string[];
  isRepeat: boolean;
}

export interface ExhibitionSellThrough {
  exhibitionId: string;
  shownCount: number;
  soldCount: number;
  /** 0–100, rounded; 0 when nothing was shown. */
  sellThroughPct: number;
  /** recordedCents + estimatedCents. */
  salesCents: number;
  /** Sales with a recorded price. */
  recordedCents: number;
  /** Unpriced sales counted at the work's set value. */
  estimatedCents: number;
  /** Provenance Value of the works sold. */
  provenanceValueCents: number;
  /** Buyers whose first purchase from the gallery came from this exhibition. */
  newCollectorKeys: string[];
  /** Every buyer of a work from this exhibition, new or returning. */
  collectorKeys: string[];
}

/** The account holding a Certificate of Ownership for a work. */
export interface OwnershipHolder {
  /** A certificate id in the same chain as the sale (any id; mapped via workKeys). */
  artwork_id: string;
  account_id: string;
  name: string | null;
  email: string | null;
  /** When the CoO was created; the latest holder wins. */
  claimed_at: string;
}

/**
 * A sale recorded without a buyer (spreadsheet "Mark sold", the sold toggle,
 * a consignment) still has a collector when someone holds the work's
 * Certificate of Ownership: use that holder as the buyer.
 */
export function fillMissingBuyers(
  sales: SaleRow[],
  holders: OwnershipHolder[],
  workKeys: Map<string, string>,
): SaleRow[] {
  if (!holders.length) return sales;
  const latestByWork = new Map<string, OwnershipHolder>();
  for (const h of holders) {
    const key = workKeyOf(workKeys, h.artwork_id);
    const existing = latestByWork.get(key);
    if (!existing || h.claimed_at > existing.claimed_at) latestByWork.set(key, h);
  }
  return sales.map((sale) => {
    if (collectorKey(sale)) return sale;
    const holder = latestByWork.get(workKeyOf(workKeys, sale.artwork_id));
    if (!holder) return sale;
    return {
      ...sale,
      sold_to_account_id: holder.account_id,
      sold_to_email: holder.email,
      sold_to_name: holder.name,
    };
  });
}

/** Buyer identity: platform account, else email, else name. */
export function collectorKey(sale: Pick<SaleRow, 'sold_to_account_id' | 'sold_to_email' | 'sold_to_name'>): string | null {
  if (sale.sold_to_account_id) return `account:${sale.sold_to_account_id}`;
  const email = sale.sold_to_email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = sale.sold_to_name?.trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

/**
 * One physical work can have several certificate rows (artist CoA, gallery
 * CoS, collector COO) chained by source_artwork_id. Map every id to a single
 * work key (the root of its chain) so sales and exhibition links line up.
 */
export function buildWorkKeys(artworks: ArtworkLinkRow[]): Map<string, string> {
  const parent = new Map<string, string>();
  for (const a of artworks) parent.set(a.id, a.id);

  const find = (id: string): string => {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.has(cur) && parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  for (const a of artworks) {
    if (!a.source_artwork_id) continue;
    if (!parent.has(a.source_artwork_id)) parent.set(a.source_artwork_id, a.source_artwork_id);
    const ra = find(a.id);
    const rb = find(a.source_artwork_id);
    if (ra !== rb) parent.set(ra, rb);
  }

  const keys = new Map<string, string>();
  for (const id of parent.keys()) keys.set(id, find(id));
  return keys;
}

function workKeyOf(workKeys: Map<string, string>, artworkId: string): string {
  return workKeys.get(artworkId) ?? artworkId;
}

/** Keep the latest sale per work: a resale replaces the earlier buyer. */
function latestSalePerWork(sales: SaleRow[], workKeys: Map<string, string>): SaleRow[] {
  const byWork = new Map<string, SaleRow>();
  for (const sale of sales) {
    const key = workKeyOf(workKeys, sale.artwork_id);
    const existing = byWork.get(key);
    if (!existing || sale.sold_at > existing.sold_at) byWork.set(key, sale);
  }
  return Array.from(byWork.values());
}

export function groupCollectors(params: {
  sales: SaleRow[];
  workKeys: Map<string, string>;
  shownLinks: ShownLink[];
  /** Current value per artwork id (the artwork the sale was recorded on). */
  currentValueCents: Map<string, number>;
}): CollectorSummary[] {
  const { workKeys, shownLinks, currentValueCents } = params;

  const exhibitionsByWork = new Map<string, Set<string>>();
  for (const link of shownLinks) {
    const key = workKeyOf(workKeys, link.artwork_id);
    if (!exhibitionsByWork.has(key)) exhibitionsByWork.set(key, new Set());
    exhibitionsByWork.get(key)!.add(link.exhibition_id);
  }

  const byCollector = new Map<string, CollectorSummary>();

  for (const sale of latestSalePerWork(params.sales, workKeys)) {
    const key = collectorKey(sale);
    if (!key) continue;

    let summary = byCollector.get(key);
    if (!summary) {
      summary = {
        key,
        accountId: sale.sold_to_account_id,
        email: sale.sold_to_email,
        name: sale.sold_to_name,
        purchaseCount: 0,
        totalSpentCents: 0,
        estimatedSpentCents: 0,
        currentValueCents: 0,
        firstPurchaseAt: sale.sold_at,
        lastPurchaseAt: sale.sold_at,
        exhibitionIds: [],
        artworkIds: [],
        isRepeat: false,
      };
      byCollector.set(key, summary);
    }

    summary.email ??= sale.sold_to_email;
    summary.name ??= sale.sold_to_name;
    summary.purchaseCount += 1;
    const amount = saleAmountCents(sale);
    summary.totalSpentCents += amount;
    if (isEstimated(sale)) summary.estimatedSpentCents += amount;
    summary.currentValueCents +=
      currentValueCents.get(sale.artwork_id) || sale.provenance_value_cents || amount;
    if (sale.sold_at < summary.firstPurchaseAt) summary.firstPurchaseAt = sale.sold_at;
    if (sale.sold_at > summary.lastPurchaseAt) summary.lastPurchaseAt = sale.sold_at;
    summary.artworkIds.push(sale.artwork_id);

    for (const exId of exhibitionsByWork.get(workKeyOf(workKeys, sale.artwork_id)) ?? []) {
      if (!summary.exhibitionIds.includes(exId)) summary.exhibitionIds.push(exId);
    }
  }

  const collectors = Array.from(byCollector.values());
  for (const c of collectors) {
    // Repeat = came back for a second show; without exhibition links, a second purchase.
    c.isRepeat = c.exhibitionIds.length >= 2 || (c.exhibitionIds.length === 0 && c.purchaseCount >= 2);
  }

  return collectors.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
}

export function computeSellThrough(params: {
  exhibitionIds: string[];
  sales: SaleRow[];
  workKeys: Map<string, string>;
  shownLinks: ShownLink[];
}): ExhibitionSellThrough[] {
  const { workKeys } = params;

  const worksByExhibition = new Map<string, Set<string>>();
  for (const id of params.exhibitionIds) worksByExhibition.set(id, new Set());
  for (const link of params.shownLinks) {
    worksByExhibition.get(link.exhibition_id)?.add(workKeyOf(workKeys, link.artwork_id));
  }

  // The gallery's first sale of each work: that's the sale the show produced.
  const firstSaleByWork = new Map<string, SaleRow>();
  for (const sale of params.sales) {
    const key = workKeyOf(workKeys, sale.artwork_id);
    const existing = firstSaleByWork.get(key);
    if (!existing || sale.sold_at < existing.sold_at) firstSaleByWork.set(key, sale);
  }

  // When each collector first bought from the gallery, and which work it was.
  const firstPurchaseByCollector = new Map<string, SaleRow>();
  for (const sale of firstSaleByWork.values()) {
    const key = collectorKey(sale);
    if (!key) continue;
    const existing = firstPurchaseByCollector.get(key);
    if (!existing || sale.sold_at < existing.sold_at) firstPurchaseByCollector.set(key, sale);
  }

  return params.exhibitionIds.map((exhibitionId) => {
    const works = worksByExhibition.get(exhibitionId) ?? new Set<string>();
    let soldCount = 0;
    let recordedCents = 0;
    let estimatedCents = 0;
    let provenanceValueCents = 0;
    const newCollectorKeys: string[] = [];
    const collectorKeys: string[] = [];

    for (const work of works) {
      const sale = firstSaleByWork.get(work);
      if (!sale) continue;
      soldCount += 1;
      const amount = saleAmountCents(sale);
      if (isEstimated(sale)) estimatedCents += amount;
      else recordedCents += amount;
      provenanceValueCents += sale.provenance_value_cents ?? amount;
      const key = collectorKey(sale);
      if (key && !collectorKeys.includes(key)) collectorKeys.push(key);
      if (key && firstPurchaseByCollector.get(key) === sale && !newCollectorKeys.includes(key)) {
        newCollectorKeys.push(key);
      }
    }

    return {
      exhibitionId,
      shownCount: works.size,
      soldCount,
      sellThroughPct: works.size ? Math.round((soldCount / works.size) * 100) : 0,
      salesCents: recordedCents + estimatedCents,
      recordedCents,
      estimatedCents,
      provenanceValueCents,
      newCollectorKeys,
      collectorKeys,
    };
  });
}
