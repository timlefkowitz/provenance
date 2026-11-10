import { describe, expect, it } from 'vitest';

import type { SaleRow } from '~/lib/collectors/group-collectors';

import { buildSalesBreakdown } from './sales-breakdown';

const sale = (id: string, artwork: string, cents: number, estimated: boolean, pv: number, day = '2026-11-07'): SaleRow => ({
  id,
  artwork_id: artwork,
  sold_to_account_id: null,
  sold_to_email: `${id}@x.com`,
  sold_to_name: null,
  price_cents: estimated ? null : cents,
  sold_at: `${day}T12:00:00Z`,
  money: { cents, basis: estimated ? 'value' : 'recorded', estimated },
  provenance_value_cents: pv,
});

describe('buildSalesBreakdown', () => {
  const workKeys = new Map([
    ['coo1', 'w1'],
    ['cos1', 'w1'],
  ]);
  const result = buildSalesBreakdown({
    sales: [sale('a', 'coo1', 45000, true, 51750), sale('b', 'w2', 100000, false, 115000)],
    workKeys,
    shownLinks: [
      { exhibition_id: 'dogs', artwork_id: 'cos1' },
      { exhibition_id: 'dogs', artwork_id: 'w3' },
      { exhibition_id: 'empty', artwork_id: 'w4' },
    ],
    exhibitions: [
      { id: 'dogs', title: 'Outside Dogs', start_date: '2026-11-05' },
      { id: 'empty', title: 'Quiet Show', start_date: null },
      { id: 'none', title: 'No works', start_date: null },
    ],
    artistByWork: new Map([
      ['w1', 'Chris King'],
      ['w2', 'Jane Doe'],
    ]),
  });

  it('totals recorded, estimated and Provenance Value separately', () => {
    expect(result.totals).toEqual({
      salesCount: 2,
      recordedCents: 100000,
      estimatedCents: 45000,
      provenanceValueCents: 166750,
    });
  });

  it('credits a show with a sale recorded on the buyer CoO of a work it hung', () => {
    expect(result.byExhibition).toEqual([
      expect.objectContaining({ title: 'Outside Dogs', shownCount: 2, salesCount: 1, sellThroughPct: 50, estimatedCents: 45000 }),
      expect.objectContaining({ title: 'Quiet Show', salesCount: 0, sellThroughPct: 0 }),
    ]);
  });

  it('groups by artist, biggest first', () => {
    expect(result.byArtist.map((a) => a.artist)).toEqual(['Jane Doe', 'Chris King']);
  });
});
