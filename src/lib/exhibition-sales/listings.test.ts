import { describe, expect, it } from 'vitest';

import {
  buildExhibitionListings,
  commissionPercentOf,
  exhibitionSalesOpen,
  isHeldByAnotherCheckout,
  isPurchasable,
  type SalesArtworkRow,
} from './listings';

function art(id: string, over: Partial<SalesArtworkRow> = {}): SalesArtworkRow {
  return {
    id,
    title: id.toUpperCase(),
    image_url: null,
    account_id: `owner-${id}`,
    artist_account_id: null,
    certificate_type: 'authenticity',
    source_artwork_id: null,
    status: 'verified',
    is_sold: false,
    sold_at: null,
    checkout_reserved_until: null,
    ...over,
  };
}

describe('buildExhibitionListings', () => {
  it('reads the per-show price off the link', () => {
    const m = buildExhibitionListings(
      [{ artwork_id: 'a', status: 'selected', for_sale: true, sale_price_cents: 50000 }],
      [art('a', { artist_account_id: 'artist' })],
    );
    const l = m.get('a')!;
    expect(l).toMatchObject({ forSale: true, priceCents: 50000, currency: 'usd', artistAccountId: 'artist', saleArtworkId: 'a' });
    expect(isPurchasable(l)).toBe(true);
  });

  it('shows the COA but sells the COS that carries the price', () => {
    const m = buildExhibitionListings(
      [
        { artwork_id: 'coa', status: 'selected' },
        { artwork_id: 'cos', status: 'selected', for_sale: true, sale_price_cents: 900 },
      ],
      [
        art('coa', { account_id: 'artist' }),
        art('cos', { certificate_type: 'show', source_artwork_id: 'coa', account_id: 'gallery' }),
      ],
    );
    expect(m.has('cos')).toBe(false);
    const l = m.get('coa')!;
    expect(l.saleArtworkId).toBe('cos');
    expect(l.artistAccountId).toBe('artist');
    expect(l.relatedArtworkIds.sort()).toEqual(['coa', 'cos']);
  });

  it('a sold COS makes the shown work sold', () => {
    const m = buildExhibitionListings(
      [{ artwork_id: 'coa', cos_artwork_id: 'cos', status: 'selected', for_sale: true, sale_price_cents: 900 }],
      [art('coa'), art('cos', { certificate_type: 'show', is_sold: true })],
    );
    expect(m.get('coa')!.isSold).toBe(true);
    expect(isPurchasable(m.get('coa')!)).toBe(false);
  });

  it('skips submissions that were not selected and works without a price', () => {
    const m = buildExhibitionListings(
      [
        { artwork_id: 'a', status: 'submitted', for_sale: true, sale_price_cents: 100 },
        { artwork_id: 'b', status: 'selected', for_sale: true, sale_price_cents: null },
      ],
      [art('a'), art('b')],
    );
    expect(m.has('a')).toBe(false);
    expect(isPurchasable(m.get('b')!)).toBe(false);
  });

  it('knows when another buyer is checking out', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    const m = buildExhibitionListings(
      [{ artwork_id: 'a', status: 'selected', for_sale: true, sale_price_cents: 100 }],
      [art('a', { checkout_reserved_until: '2026-11-22T12:10:00Z' })],
    );
    expect(isHeldByAnotherCheckout(m.get('a')!, now)).toBe(true);
    expect(isHeldByAnotherCheckout(m.get('a')!, new Date('2026-11-22T13:00:00Z'))).toBe(false);
  });
});

describe('exhibitionSalesOpen', () => {
  const ex = {
    id: 'e',
    gallery_id: 'g',
    title: 'Show',
    end_date: '2026-11-30',
    published_at: '2026-11-01T00:00:00Z',
    sales_enabled: true,
    commission_percent: '40.00',
  };
  it('open while switched on, published and not over', () => {
    expect(exhibitionSalesOpen(ex, new Date('2026-11-22T00:00:00Z'))).toBe(true);
    expect(exhibitionSalesOpen({ ...ex, sales_enabled: false })).toBe(false);
    expect(exhibitionSalesOpen({ ...ex, published_at: null })).toBe(false);
    expect(exhibitionSalesOpen(ex, new Date('2026-12-15T00:00:00Z'))).toBe(false);
  });
  it('parses commission', () => {
    expect(commissionPercentOf(ex)).toBe(40);
    expect(commissionPercentOf({ ...ex, commission_percent: null })).toBe(0);
  });
});
