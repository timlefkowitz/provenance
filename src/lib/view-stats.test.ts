import { describe, expect, it } from 'vitest';

import { computeViewStats, formatViewStats, isLikelyBot, viewStatsFromRpc } from './view-stats';

describe('view stats', () => {
  it('counts distinct browsers, and views without an id once each', () => {
    const stats = computeViewStats([
      { visitor: 'aaaaaaaaaaaaaaaa', viewed_at: '2026-11-01T10:00:00Z' },
      { visitor: 'aaaaaaaaaaaaaaaa', viewed_at: '2026-11-02T10:00:00Z' },
      { visitor: null, viewed_at: '2026-11-03T10:00:00Z' },
    ]);
    expect(stats).toEqual({ total: 3, people: 2, lastViewedAt: '2026-11-03T10:00:00Z' });
  });

  it('reads RPC rows with bigint strings', () => {
    expect(viewStatsFromRpc({ total: '12', people: '9', last_viewed_at: '2026-11-01T00:00:00Z' })).toEqual({
      total: 12,
      people: 9,
      lastViewedAt: '2026-11-01T00:00:00Z',
    });
    expect(viewStatsFromRpc(null).total).toBe(0);
  });

  it('formats counts', () => {
    expect(formatViewStats({ total: 0, people: 0, lastViewedAt: null })).toBeNull();
    expect(formatViewStats({ total: 1, people: 1, lastViewedAt: null })).toBe('Viewed 1 time by 1 person');
    expect(formatViewStats({ total: 1200, people: 800, lastViewedAt: null })).toBe(
      'Viewed 1,200 times by 800 people',
    );
  });

  it('skips crawlers and link unfurlers', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isLikelyBot('facebookexternalhit/1.1')).toBe(true);
    expect(isLikelyBot(null)).toBe(true);
    expect(
      isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'),
    ).toBe(false);
  });
});
