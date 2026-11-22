import { describe, expect, it } from 'vitest';

import { exhibitionSalesTotals } from './sales-totals';

const w = (over: Partial<{ forSale: boolean; priceCents: number | null; nfs: boolean; isSold: boolean }>) => ({
  forSale: false,
  priceCents: null,
  nfs: false,
  isSold: false,
  ...over,
});

describe('exhibitionSalesTotals', () => {
  it('totals what could sell and splits a sell-out at the commission', () => {
    const t = exhibitionSalesTotals(
      [
        w({ priceCents: 100000, forSale: true }),
        w({ priceCents: 35000 }),
        w({ nfs: true, priceCents: null }),
        w({ isSold: true, priceCents: 50000 }),
        w({}),
      ],
      30,
    );
    expect(t).toEqual({
      sellableCount: 2,
      sellableCents: 135000,
      forSaleCount: 1,
      forSaleCents: 100000,
      commissionCents: 40500,
      artistsCents: 94500,
      nfsCount: 1,
      soldCount: 1,
      noPriceCount: 1,
    });
  });

  it('rounds commission per work, like checkout', () => {
    const t = exhibitionSalesTotals([w({ priceCents: 3333 }), w({ priceCents: 3333 })], 33.33);
    expect(t.commissionCents).toBe(1111 * 2);
    expect(t.commissionCents + t.artistsCents).toBe(6666);
  });

  it('a gallery can still sell a work the artist marked NFS once it sets a price', () => {
    const t = exhibitionSalesTotals([w({ nfs: true, forSale: true, priceCents: 9000 })], 0);
    expect(t).toMatchObject({ sellableCount: 1, nfsCount: 0, commissionCents: 0, artistsCents: 9000 });
  });
});
