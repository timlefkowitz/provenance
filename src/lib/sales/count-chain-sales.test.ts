import { describe, expect, it } from 'vitest';

import { countDistinctSales } from './count-chain-sales';

describe('countDistinctSales', () => {
  it('counts same-day ledger rows as one sale', () => {
    const d = '2026-06-04T17:00:00Z';
    expect(countDistinctSales([{ sold_at: d }, { sold_at: d }, { sold_at: d }], [{ sold_at: d }])).toBe(1);
  });

  it('counts resales on different days', () => {
    expect(
      countDistinctSales([{ sold_at: '2026-01-02T00:00:00Z' }, { sold_at: '2026-05-02T00:00:00Z' }], []),
    ).toBe(2);
  });

  it('counts a certificate marked sold with no ledger row', () => {
    expect(countDistinctSales([], [{ sold_at: '2026-03-01T00:00:00Z' }])).toBe(1);
    expect(countDistinctSales([], [{ sold_at: null }])).toBe(1);
    expect(countDistinctSales([], [])).toBe(0);
  });
});
