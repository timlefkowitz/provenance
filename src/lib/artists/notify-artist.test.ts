import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('~/lib/notifications', () => ({ createNotification: vi.fn() }));
vi.mock('~/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('~/lib/sales/count-chain-sales', () => ({ countChainSales: vi.fn() }));
vi.mock('~/lib/provenance/chain', () => ({ findRootId: vi.fn(), getChainArtworkIds: vi.fn() }));

import { computeProvenanceValue } from '~/lib/valuation/provenance-value';

import { describeValueIncrease } from './notify-artist';

describe('describeValueIncrease', () => {
  it('states the premium and the new Provenance Value', () => {
    const value = computeProvenanceValue({ value: '$4,500', exhibitionCount: 0, publicationCount: 0, saleCount: 1 });
    expect(describeValueIncrease(value, 0.05, 'The sale')).toBe(
      'The sale adds 5% to its Provenance Value — now $4,725.',
    );
  });

  it('still names the premium when the work has no price', () => {
    expect(describeValueIncrease(null, 0.1, 'Its first exhibition')).toBe(
      'Its first exhibition adds 10% to its Provenance Value. Add a price to the certificate to see the figure.',
    );
  });
});
