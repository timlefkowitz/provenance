import { describe, expect, it } from 'vitest';

import {
  dedupeSameDaySales,
  listPriceOf,
  provenanceValueCents,
  resolveSaleMoney,
  setValueCents,
} from './sale-money';

describe('resolveSaleMoney', () => {
  it('uses the recorded price first', () => {
    expect(resolveSaleMoney({ priceCents: 50000, chainSoldPriceCents: 1, setValueCents: 2 })).toEqual({
      cents: 50000,
      basis: 'recorded',
      estimated: false,
    });
  });

  it('falls back to a price recorded on a linked certificate', () => {
    expect(resolveSaleMoney({ priceCents: null, chainSoldPriceCents: 70000, setValueCents: 2 }).basis).toBe(
      'chain_recorded',
    );
  });

  it('counts an unpriced sale at the set value, marked estimated', () => {
    expect(resolveSaleMoney({ priceCents: null, setValueCents: 45000 })).toEqual({
      cents: 45000,
      basis: 'value',
      estimated: true,
    });
  });

  it('is zero with nothing to go on', () => {
    expect(resolveSaleMoney({ priceCents: null })).toEqual({ cents: 0, basis: 'none', estimated: false });
  });
});

describe('set value', () => {
  it('prefers the exhibition list price over the artist value', () => {
    expect(listPriceOf({ value: '$900', metadata: { exhibition_list_price: '$1,200' } })).toBe('$1,200');
    expect(setValueCents({ value: '$900', metadata: { exhibition_list_price: '$1,200' } })).toBe(120000);
  });

  it('reads the artist value and ignores non-prices', () => {
    expect(setValueCents({ value: '450' })).toBe(45000);
    expect(setValueCents({ value: 'NFS' })).toBeNull();
    expect(setValueCents({ value: null })).toBeNull();
  });
});

describe('provenanceValueCents', () => {
  it('adds the exhibition and sale premiums to the set value', () => {
    expect(provenanceValueCents({ value: '$1,000', exhibitionCount: 1, publicationCount: 0, saleCount: 1 })).toBe(
      115000,
    );
  });

  it('uses the sale price as base when there is no set value', () => {
    expect(
      provenanceValueCents({ value: null, exhibitionCount: 0, publicationCount: 0, saleCount: 1, salePriceCents: 200000 }),
    ).toBe(210000);
  });
});

describe('dedupeSameDaySales', () => {
  const keys = new Map([
    ['cos', 'coa'],
    ['coa', 'coa'],
  ]);

  it('keeps one sale per work per day, preferring a priced row', () => {
    const rows = [
      { id: 'a', artwork_id: 'coa', sold_at: '2026-06-04T17:00:00Z', price_cents: null },
      { id: 'b', artwork_id: 'cos', sold_at: '2026-06-04T09:00:00Z', price_cents: 45000 },
      { id: 'c', artwork_id: 'coa', sold_at: '2026-09-01T00:00:00Z', price_cents: null },
    ];
    expect(dedupeSameDaySales(rows, keys).map((r) => r.id)).toEqual(['b', 'c']);
  });
});
