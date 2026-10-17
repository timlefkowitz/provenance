import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import { parseSalesReport } from './app-store-connect';

const HEADER = [
  'Provider',
  'SKU',
  'Title',
  'Product Type Identifier',
  'Units',
  'Country Code',
  'Apple Identifier',
].join('\t');

function row(type: string, units: number, country: string, appleId = '111') {
  return ['APPLE', 'sku', 'Provenance', type, String(units), country, appleId].join('\t');
}

describe('parseSalesReport', () => {
  it('splits first-time downloads, redownloads and updates', () => {
    const tsv = [
      HEADER,
      row('1', 3, 'US'),
      row('1F', 2, 'GB'),
      row('3F', 4, 'US'),
      row('7', 5, 'US'),
      row('IA1', 9, 'US'),
    ].join('\n');
    expect(parseSalesReport(tsv)).toEqual({
      downloads: 5,
      redownloads: 4,
      updates: 5,
      countries: { US: 3, GB: 2 },
    });
  });

  it('keeps only rows for the given Apple ID', () => {
    const tsv = [HEADER, row('1', 3, 'US', '111'), row('1', 7, 'US', '222')].join('\n');
    expect(parseSalesReport(tsv, '111').downloads).toBe(3);
  });

  it('returns zeros for an unexpected header', () => {
    expect(parseSalesReport('foo\tbar\n1\t2').downloads).toBe(0);
  });
});
