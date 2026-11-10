import { describe, expect, it } from 'vitest';

import { buildWorkKeys } from '~/lib/collectors/group-collectors';
import { countExhibitionsByWork, type ChainArtwork } from '~/lib/sales/load-chain-sales';

import { computeChainProvenanceValue } from './load-chain-provenance-values';

const art = (id: string, source: string | null, extra: Partial<ChainArtwork> = {}): ChainArtwork => ({
  id,
  source_artwork_id: source,
  account_id: 'acct',
  value: null,
  metadata: null,
  sold_price_cents: null,
  publications: null,
  certificate_type: 'authenticity',
  ...extra,
});

function valueFor(rows: ChainArtwork[], links: Array<{ exhibition_id: string; artwork_id: string; status?: string | null }> = [], ledger: Array<{ artwork_id: string; sold_at: string; price_cents: number | null }> = []) {
  const workKeys = buildWorkKeys(rows);
  const counts = countExhibitionsByWork(links, rows, workKeys);
  const rootId = workKeys.get(rows[0]!.id)!;
  return computeChainProvenanceValue({ rows, rootId, exhibitionCount: counts.get(rootId) ?? 0, ledger });
}

describe('computeChainProvenanceValue', () => {
  it('a CoS with no exhibition row still counts as exhibited', () => {
    const pv = valueFor([art('coa', null, { value: '$1,000' }), art('cos', 'coa', { certificate_type: 'show' })]);
    expect(pv?.total).toBe(1100);
    expect(pv?.premiums.map((p) => p.label)).toEqual(['Exhibited']);
  });

  it("ignores a buyer's own CoO value when the seller priced the work", () => {
    const pv = valueFor(
      [
        art('coa', null, { value: '1000', is_sold: true, sold_at: '2026-05-01T00:00:00Z' }),
        art('coo', 'coa', { value: '1,000,000', certificate_type: 'ownership' }),
      ],
    );
    expect(pv?.base).toBe(1000);
    expect(pv?.total).toBe(1050);
  });

  it('uses the list price of a standalone CoS', () => {
    const pv = valueFor([
      art('cos', null, { certificate_type: 'show', metadata: { exhibition_list_price: '2000', exhibition_id: 'ex1' } }),
    ]);
    expect(pv?.base).toBe(2000);
    expect(pv?.total).toBe(2200);
  });

  it('an email-only sale with no typed value uses the sale price plus Sold', () => {
    const pv = valueFor(
      [art('coa', null, { is_sold: true, sold_at: '2026-06-01T10:00:00Z' })],
      [],
      [{ artwork_id: 'coa', sold_at: '2026-06-01T10:00:00Z', price_cents: 50000 }],
    );
    expect(pv?.base).toBe(500);
    expect(pv?.total).toBe(525);
  });

  it('counts shows, publications and sales across every certificate of the work', () => {
    const rows = [
      art('coa', null, { value: '1000', publications: [{ title: 'Review' }] }),
      art('cos', 'coa', { certificate_type: 'show', metadata: { exhibition_id: 'ex1' } }),
      art('coo', 'cos', { certificate_type: 'ownership', is_sold: true, sold_at: '2026-03-01T00:00:00Z' }),
    ];
    const pv = valueFor(rows, [
      { exhibition_id: 'ex1', artwork_id: 'coa' },
      { exhibition_id: 'ex1', artwork_id: 'cos' },
      { exhibition_id: 'ex2', artwork_id: 'coa', status: 'declined' },
    ]);
    // +10% exhibited, +5% published, +5% one sale
    expect(pv?.total).toBe(1200);
  });
});

describe('countExhibitionsByWork', () => {
  it('skips works not selected into a show', () => {
    const rows = [art('a', null)];
    const counts = countExhibitionsByWork([{ exhibition_id: 'e', artwork_id: 'a', status: 'declined' }], rows, buildWorkKeys(rows));
    expect(counts.get('a') ?? 0).toBe(0);
  });
});
