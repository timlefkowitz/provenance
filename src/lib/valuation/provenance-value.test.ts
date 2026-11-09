import { describe, expect, it } from 'vitest';

import {
  computeProvenanceValue,
  formatProvenanceAmount,
  parseArtworkPrice,
  sanitizePublications,
} from './provenance-value';

describe('parseArtworkPrice', () => {
  it.each([
    ['$4,500', 4500, '$', null],
    ['4500 USD', 4500, null, 'USD'],
    ['€12.000', 12000, '€', null],
    ['$1,250.50', 1250.5, '$', null],
    ['$2.5k', 2500, '$', null],
    ['£800', 800, '£', null],
  ])('%s', (raw, amount, symbol, code) => {
    expect(parseArtworkPrice(raw)).toEqual({ amount, symbol, code });
  });

  it.each(['', 'NFS', 'Price on request', '$3,000 - $5,000', '$0'])('rejects %s', (raw) => {
    expect(parseArtworkPrice(raw)).toBeNull();
  });
});

describe('computeProvenanceValue', () => {
  it('adds 10% for an exhibition', () => {
    const v = computeProvenanceValue({ value: '$4,500', exhibitionCount: 2, publicationCount: 0 });
    expect(v?.total).toBe(4950);
    expect(v?.premiums.map((p) => p.label)).toEqual(['Exhibited']);
  });

  it('adds 5% for a publication', () => {
    expect(
      computeProvenanceValue({ value: '$1,000', exhibitionCount: 0, publicationCount: 1 })?.total,
    ).toBe(1050);
  });

  it('adds both premiums together (15%)', () => {
    expect(
      computeProvenanceValue({ value: '$1,000', exhibitionCount: 1, publicationCount: 3 })?.total,
    ).toBe(1150);
  });

  it('adds 10% for a recorded sale, stacking with exhibition', () => {
    const v = computeProvenanceValue({
      value: '$1,000',
      exhibitionCount: 1,
      publicationCount: 0,
      sale: { priceCents: null, currency: null },
    });
    expect(v?.total).toBe(1200);
    expect(v?.premiums.map((p) => p.label)).toEqual(['Exhibited', 'Sold']);
  });

  it('uses the sale price as base when the artist listed no price', () => {
    const v = computeProvenanceValue({
      value: null,
      exhibitionCount: 1,
      publicationCount: 0,
      sale: { priceCents: 200000, currency: 'USD' },
    });
    expect(v?.base).toBe(2000);
    expect(v?.total).toBe(2400);
    expect(v && formatProvenanceAmount(v.total, v.currency)).toBe('$2,400');
  });

  it('is null with no premiums or no parseable price', () => {
    expect(computeProvenanceValue({ value: '$1,000', exhibitionCount: 0, publicationCount: 0 })).toBeNull();
    expect(computeProvenanceValue({ value: 'NFS', exhibitionCount: 1, publicationCount: 1 })).toBeNull();
  });
});

describe('formatProvenanceAmount', () => {
  it('keeps the artist currency', () => {
    expect(formatProvenanceAmount(4950, { symbol: '$', code: null })).toBe('$4,950');
    expect(formatProvenanceAmount(1150, { symbol: null, code: 'EUR' })).toBe('1,150 EUR');
  });
});

describe('sanitizePublications', () => {
  it('drops untitled entries and normalises urls', () => {
    expect(
      sanitizePublications([
        { title: '  Artforum review ', url: 'artforum.com/x', publication_name: 'Artforum' },
        { title: '' },
        'junk',
      ]),
    ).toEqual([
      { title: 'Artforum review', publication_name: 'Artforum', url: 'https://artforum.com/x', date: null },
    ]);
  });
});
