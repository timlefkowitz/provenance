import { describe, expect, it } from 'vitest';

import {
  buildWorkKeys,
  collectorKey,
  computeSellThrough,
  groupCollectors,
  type SaleRow,
} from './group-collectors';

function sale(overrides: Partial<SaleRow> & Pick<SaleRow, 'id' | 'artwork_id'>): SaleRow {
  return {
    sold_to_account_id: null,
    sold_to_email: null,
    sold_to_name: null,
    price_cents: 100_000,
    sold_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('collectorKey', () => {
  it('prefers account, then email (case-insensitive), then name', () => {
    expect(collectorKey({ sold_to_account_id: 'a1', sold_to_email: 'X@y.com', sold_to_name: 'X' })).toBe('account:a1');
    expect(collectorKey({ sold_to_account_id: null, sold_to_email: ' X@Y.com ', sold_to_name: 'X' })).toBe('email:x@y.com');
    expect(collectorKey({ sold_to_account_id: null, sold_to_email: null, sold_to_name: 'Ann' })).toBe('name:ann');
    expect(collectorKey({ sold_to_account_id: null, sold_to_email: '', sold_to_name: null })).toBeNull();
  });
});

describe('buildWorkKeys', () => {
  it('maps a CoA, its CoS and a downstream COO to one work', () => {
    const keys = buildWorkKeys([
      { id: 'coa', source_artwork_id: null },
      { id: 'cos', source_artwork_id: 'coa' },
      { id: 'coo', source_artwork_id: 'cos' },
      { id: 'other', source_artwork_id: null },
    ]);
    expect(keys.get('cos')).toBe(keys.get('coa'));
    expect(keys.get('coo')).toBe(keys.get('coa'));
    expect(keys.get('other')).toBe('other');
  });
});

describe('groupCollectors', () => {
  const workKeys = buildWorkKeys([
    { id: 'coa1', source_artwork_id: null },
    { id: 'cos1', source_artwork_id: 'coa1' },
    { id: 'w2', source_artwork_id: null },
    { id: 'w3', source_artwork_id: null },
  ]);

  it('totals spend and value, and flags collectors who bought from two shows', () => {
    const collectors = groupCollectors({
      sales: [
        sale({ id: 's1', artwork_id: 'cos1', sold_to_email: 'ann@x.com', price_cents: 200_000 }),
        sale({ id: 's2', artwork_id: 'w2', sold_to_email: 'ANN@x.com', price_cents: 50_000, sold_at: '2026-09-01T00:00:00Z' }),
        sale({ id: 's3', artwork_id: 'w3', sold_to_name: 'Bob', price_cents: 10_000 }),
      ],
      workKeys,
      // The show linked the artist CoA; the sale was recorded on the CoS.
      shownLinks: [
        { exhibition_id: 'exA', artwork_id: 'coa1' },
        { exhibition_id: 'exB', artwork_id: 'w2' },
        { exhibition_id: 'exB', artwork_id: 'w3' },
      ],
      currentValueCents: new Map([['cos1', 300_000]]),
    });

    expect(collectors.map((c) => c.key)).toEqual(['email:ann@x.com', 'name:bob']);
    const ann = collectors[0]!;
    expect(ann.purchaseCount).toBe(2);
    expect(ann.totalSpentCents).toBe(250_000);
    // Unvalued works fall back to the price paid.
    expect(ann.currentValueCents).toBe(350_000);
    expect(ann.exhibitionIds.sort()).toEqual(['exA', 'exB']);
    expect(ann.lastPurchaseAt).toBe('2026-09-01T00:00:00Z');
    expect(ann.isRepeat).toBe(true);
    expect(collectors[1]!.isRepeat).toBe(false);
  });

  it('counts two purchases outside any show as repeat', () => {
    const [c] = groupCollectors({
      sales: [
        sale({ id: 's1', artwork_id: 'w2', sold_to_account_id: 'acc' }),
        sale({ id: 's2', artwork_id: 'w3', sold_to_account_id: 'acc' }),
      ],
      workKeys,
      shownLinks: [],
      currentValueCents: new Map(),
    });
    expect(c!.isRepeat).toBe(true);
  });

  it('credits a resold work to its latest buyer only', () => {
    const collectors = groupCollectors({
      sales: [
        sale({ id: 's1', artwork_id: 'w2', sold_to_name: 'First', sold_at: '2026-01-01T00:00:00Z' }),
        sale({ id: 's2', artwork_id: 'w2', sold_to_name: 'Second', sold_at: '2026-06-01T00:00:00Z' }),
      ],
      workKeys,
      shownLinks: [],
      currentValueCents: new Map(),
    });
    expect(collectors.map((c) => c.key)).toEqual(['name:second']);
  });
});

describe('computeSellThrough', () => {
  it('reports sold/shown, sales and new collectors per show', () => {
    const workKeys = buildWorkKeys([
      { id: 'coa1', source_artwork_id: null },
      { id: 'cos1', source_artwork_id: 'coa1' },
    ]);
    const result = computeSellThrough({
      exhibitionIds: ['exA', 'exB', 'exEmpty'],
      workKeys,
      shownLinks: [
        // CoA and its CoS both linked: still one work.
        { exhibition_id: 'exA', artwork_id: 'coa1' },
        { exhibition_id: 'exA', artwork_id: 'cos1' },
        { exhibition_id: 'exA', artwork_id: 'w2' },
        { exhibition_id: 'exB', artwork_id: 'w3' },
        { exhibition_id: 'exB', artwork_id: 'w4' },
      ],
      sales: [
        sale({ id: 's1', artwork_id: 'cos1', sold_to_name: 'Ann', price_cents: 200_000, sold_at: '2026-03-01T00:00:00Z' }),
        sale({ id: 's2', artwork_id: 'w3', sold_to_name: 'Ann', price_cents: 40_000, sold_at: '2026-08-01T00:00:00Z' }),
        sale({ id: 's3', artwork_id: 'w4', sold_to_name: 'Cal', price_cents: 60_000, sold_at: '2026-08-02T00:00:00Z' }),
      ],
    });

    expect(result[0]).toEqual({
      exhibitionId: 'exA',
      shownCount: 2,
      soldCount: 1,
      sellThroughPct: 50,
      salesCents: 200_000,
      newCollectorKeys: ['name:ann'],
    });
    // Ann already bought at exA, so only Cal is new at exB.
    expect(result[1]).toMatchObject({ shownCount: 2, soldCount: 2, sellThroughPct: 100, salesCents: 100_000, newCollectorKeys: ['name:cal'] });
    expect(result[2]).toMatchObject({ shownCount: 0, soldCount: 0, sellThroughPct: 0 });
  });
});
