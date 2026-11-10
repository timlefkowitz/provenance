import { describe, expect, it } from 'vitest';

import { buildWorkKeys } from '~/lib/collectors/group-collectors';

import { artworkOnlySales, priceSales, type ChainArtwork } from './load-chain-sales';

const art = (id: string, source: string | null, extra: Partial<ChainArtwork> = {}): ChainArtwork => ({
  id,
  source_artwork_id: source,
  account_id: 'gallery',
  value: null,
  metadata: null,
  sold_price_cents: null,
  publications: null,
  ...extra,
});

const sale = (id: string, artworkId: string, day: string, price: number | null) => ({
  id,
  artwork_id: artworkId,
  sold_to_account_id: null,
  sold_to_email: 'buyer@x.com',
  sold_to_name: null,
  price_cents: price,
  sold_at: `${day}T12:00:00Z`,
});

describe('priceSales', () => {
  // Artist CoA (no value) → show CoS ($450 list price) → buyer CoO.
  const chain = [
    art('coa', null),
    art('cos', 'coa', { value: '450' }),
    art('coo', 'cos'),
  ];
  const workKeys = buildWorkKeys(chain);

  it('counts an unpriced CoO sale at the show value and adds Provenance Value', () => {
    const [s] = priceSales({
      sales: [sale('l1', 'coo', '2026-11-07', null)],
      chain,
      workKeys,
      exhibitionCountByWork: new Map([[workKeys.get('cos')!, 1]]),
    });
    expect(s!.money).toEqual({ cents: 45000, basis: 'value', estimated: true });
    // $450 + 10% exhibited + 5% sold
    expect(s!.provenance_value_cents).toBe(51750);
  });

  it('collapses the same sale recorded on two certificates, keeping the priced one', () => {
    const out = priceSales({
      sales: [sale('a', 'coa', '2026-06-04', null), sale('b', 'cos', '2026-06-04', 40000)],
      chain,
      workKeys,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.money).toEqual({ cents: 40000, basis: 'recorded', estimated: false });
  });

  it('uses a price recorded on a linked certificate', () => {
    const priced = [art('coa', null, { sold_price_cents: 90000 }), art('cos', 'coa')];
    const [s] = priceSales({ sales: [sale('x', 'cos', '2026-01-01', null)], chain: priced, workKeys: buildWorkKeys(priced) });
    expect(s!.money?.basis).toBe('chain_recorded');
    expect(s!.money?.cents).toBe(90000);
  });
});

describe('artworkOnlySales', () => {
  it('adds a sale marked on a certificate only when the work has no ledger row', () => {
    const chain = [art('coa', null), art('cos', 'coa'), art('other', null)];
    const keys = buildWorkKeys(chain);
    const sold = (id: string) => ({
      id,
      is_sold: true,
      sold_at: '2026-02-01T00:00:00Z',
      sold_price_cents: null,
      sold_to_account_id: null,
      sold_to_email: null,
      sold_to_name: null,
    });
    const out = artworkOnlySales([sold('cos'), sold('other')], [sale('l', 'coa', '2026-02-01', null)], keys);
    expect(out.map((s) => s.artwork_id)).toEqual(['other']);
  });
});

describe('isCreditedSale', async () => {
  const { isCreditedSale } = await import('./load-account-sales');
  const workKeys = new Map([
    ['coa', 'coa'],
    ['cos', 'coa'],
    ['coo', 'coa'],
  ]);
  const ctx = { accountId: 'gallery', creditedWorkKeys: new Set(['coa']), workKeys };

  it('credits the gallery for a sale recorded on the buyer CoO of a work it showed', () => {
    expect(isCreditedSale({ artwork_id: 'coo', sold_to_account_id: 'buyer', sold_by_account_id: 'artist' }, ctx)).toBe(true);
  });

  it('never counts a purchase as a sale', () => {
    expect(isCreditedSale({ artwork_id: 'coa', sold_to_account_id: 'gallery', sold_by_account_id: null }, ctx)).toBe(false);
  });

  it('credits the seller even for a work outside its roster', () => {
    expect(
      isCreditedSale({ artwork_id: 'elsewhere', sold_to_account_id: null, sold_by_account_id: 'gallery' }, ctx),
    ).toBe(true);
    expect(
      isCreditedSale({ artwork_id: 'elsewhere', sold_to_account_id: null, sold_by_account_id: 'other' }, ctx),
    ).toBe(false);
  });
});
