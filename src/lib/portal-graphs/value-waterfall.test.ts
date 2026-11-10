import { describe, expect, it } from 'vitest';

import { valueAt } from './value-waterfall';

const now = new Date('2026-11-10T00:00:00Z');
const base = { id: 'a', sold_price_cents: null, sold_at: null, value: '$1,000' };

describe('valueAt with Provenance Value', () => {
  it('lifts a declared value to the Provenance Value', () => {
    const r = valueAt({ ...base, provenance_value_cents: 110000 }, [], now);
    expect(r.source).toBe('provenance_value');
    expect(r.value_cents).toBe(110000);
  });

  it('keeps a formal valuation on top', () => {
    const r = valueAt(
      { ...base, provenance_value_cents: 110000 },
      [{ artwork_id: 'a', generated_at: '2026-01-01T00:00:00Z', estimated_value_cents: 90000, confidence_low_cents: null, confidence_high_cents: null }],
      now,
    );
    expect(r.source).toBe('formal_valuation');
  });

  it('does not invent value for a work with nothing on record yet', () => {
    const r = valueAt({ ...base, value: null, provenance_value_cents: 110000 }, [], now);
    expect(r.source).toBe('unknown');
  });

  it('falls back to the declared value without a Provenance Value', () => {
    expect(valueAt(base, [], now).source).toBe('declared_value');
  });
});
