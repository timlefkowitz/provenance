import { describe, expect, it } from 'vitest';

import {
  EMPTY_SCAN_STATS,
  computeScanStats,
  formatScanStats,
  isScanVisitorId,
  nextScanTotal,
  stripScanDetails,
} from './scan-stats';

const A = 'a1b2c3d4e5f6a7b8c9d0e1f2';
const B = 'ffffffffffffffffffffffff';

describe('computeScanStats', () => {
  it('is empty without scans', () => {
    expect(computeScanStats(undefined)).toEqual(EMPTY_SCAN_STATS);
    expect(computeScanStats({ scan_locations: 'nope' })).toEqual(EMPTY_SCAN_STATS);
  });

  it('counts scans and distinct people, excluding the owner', () => {
    const stats = computeScanStats({
      scan_locations: [
        { scanned_at: '2026-11-01T10:00:00Z', visitor: A },
        { scanned_at: '2026-11-02T10:00:00Z', visitor: A },
        { scanned_at: '2026-11-03T10:00:00Z', visitor: B },
        { scanned_at: '2026-11-04T10:00:00Z', visitor: A, by_owner: true },
      ],
    });
    expect(stats).toEqual({ total: 3, people: 2, lastScannedAt: '2026-11-03T10:00:00Z' });
  });

  it('counts older scans without a visitor id as one person each', () => {
    const stats = computeScanStats({ scan_locations: [{ scanned_at: 'x' }, { scanned_at: 'y' }, { visitor: A }] });
    expect(stats.total).toBe(3);
    expect(stats.people).toBe(3);
  });

  it('keeps counting past the stored-scan cap', () => {
    const stats = computeScanStats({ scan_stats: { total: 900 }, scan_locations: [{ visitor: A }, { visitor: B }] });
    expect(stats.total).toBe(900);
    expect(stats.people).toBe(2);
  });
});

describe('nextScanTotal', () => {
  it('starts from the existing scans and skips the owner', () => {
    const meta = { scan_locations: [{ visitor: A }, { visitor: B, by_owner: true }] };
    expect(nextScanTotal(meta, false)).toBe(2);
    expect(nextScanTotal(meta, true)).toBe(1);
    expect(nextScanTotal({ scan_stats: { total: 600 }, scan_locations: [] }, false)).toBe(601);
  });
});

describe('stripScanDetails', () => {
  it('removes per-scan dates and places but keeps everything else', () => {
    const meta = { curator: 'x', scan_stats: { total: 2 }, scan_locations: [{ formatted: '12 Main St' }] };
    expect(stripScanDetails(meta)).toEqual({ curator: 'x', scan_stats: { total: 2 } });
    expect(stripScanDetails(null)).toBeNull();
  });
});

describe('formatScanStats / isScanVisitorId', () => {
  it('formats counts', () => {
    expect(formatScanStats(EMPTY_SCAN_STATS)).toBeNull();
    expect(formatScanStats({ total: 1, people: 1, lastScannedAt: null })).toBe('Scanned 1 time by 1 person');
    expect(formatScanStats({ total: 1234, people: 31, lastScannedAt: null })).toBe(
      'Scanned 1,234 times by 31 people',
    );
  });

  it('validates visitor ids', () => {
    expect(isScanVisitorId(A)).toBe(true);
    expect(isScanVisitorId('short')).toBe(false);
    expect(isScanVisitorId('<script>alert(1)</script>xxxxxxxx')).toBe(false);
  });
});
