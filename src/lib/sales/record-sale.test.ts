import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/stats/refresh-entity-stats', () => ({ refreshEntityStatsForAccounts: vi.fn() }));
vi.mock('~/lib/provenance/chain', () => ({
  syncProvenanceAcrossChain: vi.fn(),
  transferOwnershipAcrossChain: vi.fn(),
}));
vi.mock('~/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { hasSaleLine, saleProvenanceLine } from './record-sale';

describe('sale provenance line', () => {
  it('writes the date only', () => {
    expect(saleProvenanceLine('2026-11-09T18:00:00Z')).toBe('Sold, November 9, 2026');
  });

  it('spots an existing line for that day, including the collection editor style', () => {
    const at = '2026-07-14T12:00:00Z';
    expect(hasSaleLine('Sold, July 14, 2026', at)).toBe(true);
    expect(hasSaleLine('Christie’s 1999\nSold to Jane Doe for USD 1,200, July 14, 2026', at)).toBe(true);
    expect(hasSaleLine('Sold 2026-07-14', at)).toBe(true);
    expect(hasSaleLine('Sold, July 15, 2026', at)).toBe(false);
    expect(hasSaleLine(null, at)).toBe(false);
  });
});
