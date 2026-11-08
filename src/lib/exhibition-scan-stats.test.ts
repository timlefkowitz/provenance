import { describe, expect, it } from 'vitest';

import {
  EMPTY_WORK_SCAN_STATS,
  computeExhibitionWorkScanStats,
  exhibitionScanWindow,
  inScanWindow,
  scanPlaceLabel,
} from './exhibition-scan-stats';

const A = 'a1b2c3d4e5f6a7b8c9d0e1f2';
const B = 'ffffffffffffffffffffffff';
const SHOW = { from: '2026-11-01', to: '2026-11-30' };

describe('inScanWindow', () => {
  it('includes the whole end day and a day of slack for time zones', () => {
    expect(inScanWindow('2026-11-30T23:30:00Z', SHOW)).toBe(true);
    expect(inScanWindow('2026-10-31T20:00:00Z', SHOW)).toBe(true);
    expect(inScanWindow('2026-10-29T12:00:00Z', SHOW)).toBe(false);
    expect(inScanWindow('2026-12-05T12:00:00Z', SHOW)).toBe(false);
  });

  it('has no end while the show runs, and rejects bad dates', () => {
    expect(inScanWindow('2027-06-01T00:00:00Z', { from: '2026-11-01', to: null })).toBe(true);
    expect(inScanWindow('nope', SHOW)).toBe(false);
    expect(inScanWindow(undefined, SHOW)).toBe(false);
  });
});

describe('scanPlaceLabel', () => {
  it('prefers the browser place, falls back to the network place, decodes', () => {
    expect(scanPlaceLabel({ city: 'Chicago', region: 'IL', country: 'US' })).toBe('Chicago, IL, US');
    expect(scanPlaceLabel({ ip_city: 'S%C3%A3o%20Paulo', ip_country: 'BR' })).toBe('São Paulo, BR');
    expect(scanPlaceLabel({ ip_country: 'FR' })).toBe('FR');
    expect(scanPlaceLabel({})).toBeNull();
  });
});

describe('computeExhibitionWorkScanStats', () => {
  it('is empty without scans', () => {
    expect(computeExhibitionWorkScanStats([undefined, {}], SHOW)).toEqual(EMPTY_WORK_SCAN_STATS);
  });

  it('combines a COA and its Certificate of Show, counting only scans during the show', () => {
    const coa = {
      scan_locations: [
        { scanned_at: '2026-09-01T10:00:00Z', visitor: A, city: 'Home', country: 'US' },
        { scanned_at: '2026-11-03T10:00:00Z', visitor: A, ip_city: 'Chicago', ip_region: 'IL', ip_country: 'US' },
      ],
    };
    const cos = {
      scan_locations: [
        { scanned_at: '2026-11-04T10:00:00Z', visitor: B, ip_city: 'Chicago', ip_region: 'IL', ip_country: 'US' },
        { scanned_at: '2026-11-05T10:00:00Z' },
        { scanned_at: '2026-11-06T10:00:00Z', by_owner: true, city: 'Gallery' },
      ],
      scan_stats: { total: 9 },
    };
    const stats = computeExhibitionWorkScanStats([coa, cos], SHOW);
    expect(stats.duringShow).toBe(3);
    expect(stats.peopleDuringShow).toBe(3);
    expect(stats.allTime).toBe(2 + 9);
    expect(stats.lastScannedAt).toBe('2026-11-05T10:00:00Z');
    // The pre-show home scan and the owner's scan don't reveal their places.
    expect(stats.places).toEqual([{ label: 'Chicago, IL, US', count: 2 }]);
  });

  it('keeps at most five places, most first', () => {
    const scans = ['A', 'B', 'C', 'D', 'E', 'F', 'F'].map((city, i) => ({
      scanned_at: `2026-11-1${i}T10:00:00Z`,
      city,
    }));
    const { places } = computeExhibitionWorkScanStats([{ scan_locations: scans }], SHOW);
    expect(places).toHaveLength(5);
    expect(places[0]).toEqual({ label: 'F', count: 2 });
  });
});

describe('exhibitionScanWindow', () => {
  it('uses the show dates, else when the work joined', () => {
    expect(exhibitionScanWindow({ start_date: '2026-11-01', end_date: null })).toEqual({
      from: '2026-11-01',
      to: null,
    });
    expect(exhibitionScanWindow({ start_date: '', end_date: null }, '2026-10-20T00:00:00Z')).toEqual({
      from: '2026-10-20T00:00:00Z',
      to: null,
    });
  });
});
