export type TotalsWork = {
  forSale: boolean;
  priceCents: number | null;
  nfs: boolean;
  isSold: boolean;
};

export type SalesTotals = {
  /** Unsold works with a price that aren't NFS: what could still sell. */
  sellableCount: number;
  sellableCents: number;
  /** Of those, the ones a buyer can add to the cart right now. */
  forSaleCount: number;
  forSaleCents: number;
  /** The gallery's commission and the artists' share if every sellable work sold. */
  commissionCents: number;
  artistsCents: number;
  nfsCount: number;
  soldCount: number;
  noPriceCount: number;
};

/**
 * What the show is worth at its current prices and how a sell-out would
 * split. Commission is worked out per work (as checkout does) so the totals
 * match what galleries and artists would be booked, before fees.
 */
export function exhibitionSalesTotals(works: TotalsWork[], commissionPercent: number): SalesTotals {
  const pct = Number.isFinite(commissionPercent) ? Math.min(100, Math.max(0, commissionPercent)) : 0;
  const t: SalesTotals = {
    sellableCount: 0,
    sellableCents: 0,
    forSaleCount: 0,
    forSaleCents: 0,
    commissionCents: 0,
    artistsCents: 0,
    nfsCount: 0,
    soldCount: 0,
    noPriceCount: 0,
  };
  for (const w of works) {
    if (w.isSold) {
      t.soldCount++;
      continue;
    }
    if (w.nfs && !w.forSale) {
      t.nfsCount++;
      continue;
    }
    const price = w.priceCents ?? 0;
    if (price <= 0) {
      t.noPriceCount++;
      continue;
    }
    t.sellableCount++;
    t.sellableCents += price;
    if (w.forSale) {
      t.forSaleCount++;
      t.forSaleCents += price;
    }
    const commission = Math.round((price * pct) / 100);
    t.commissionCents += commission;
    t.artistsCents += price - commission;
  }
  return t;
}
