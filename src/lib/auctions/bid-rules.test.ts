import { describe, expect, it } from 'vitest';

import {
  auctionPhase,
  bidErrorMessage,
  bidderLabels,
  decideLotOutcome,
  defaultStartPriceCents,
  extendForAntiSnipe,
  incrementFor,
  lotEndTimes,
  nextMinimumBid,
  parseMoneyToCents,
  reserveMet,
  viewerLotStatus,
} from './bid-rules';

describe('incrementFor', () => {
  // Same cases as auction_bid_increment() in the auctions migration.
  it.each([
    [0, 2_500],
    [49_999, 2_500],
    [50_000, 5_000],
    [99_999, 5_000],
    [100_000, 10_000],
    [499_999, 10_000],
    [500_000, 25_000],
    [999_999, 25_000],
    [1_000_000, 50_000],
    [4_999_999, 50_000],
    [5_000_000, 100_000],
  ])('%i cents → %i', (current, step) => {
    expect(incrementFor(current)).toBe(step);
  });
});

describe('nextMinimumBid', () => {
  it('is the start price before any bid, at least $1', () => {
    expect(nextMinimumBid({ start_price_cents: 20_000 })).toBe(20_000);
    expect(nextMinimumBid({ start_price_cents: 0 })).toBe(100);
  });

  it('adds the ladder increment to the current bid', () => {
    expect(nextMinimumBid({ start_price_cents: 0, current_bid_cents: 60_000 })).toBe(65_000);
  });

  it('uses a fixed increment when the lot sets one', () => {
    expect(nextMinimumBid({ start_price_cents: 0, current_bid_cents: 60_000, increment_cents: 1_000 })).toBe(61_000);
  });
});

describe('extendForAntiSnipe', () => {
  const end = new Date('2026-11-20T18:00:00Z');

  it('pushes the close out when a bid lands in the window', () => {
    const now = new Date('2026-11-20T17:59:30Z');
    const r = extendForAntiSnipe(end, now, 120);
    expect(r.extended).toBe(true);
    expect(r.endsAt.toISOString()).toBe('2026-11-20T18:01:30.000Z');
  });

  it('leaves the close alone outside the window or when disabled', () => {
    expect(extendForAntiSnipe(end, new Date('2026-11-20T17:50:00Z'), 120).extended).toBe(false);
    expect(extendForAntiSnipe(end, new Date('2026-11-20T17:59:59Z'), 0).extended).toBe(false);
  });
});

describe('reserve and outcome', () => {
  it('reserveMet', () => {
    expect(reserveMet(null, null)).toBe(false);
    expect(reserveMet(1000, null)).toBe(true);
    expect(reserveMet(1000, 1000)).toBe(true);
    expect(reserveMet(999, 1000)).toBe(false);
  });

  it('sells to the high bidder when the reserve is met', () => {
    expect(decideLotOutcome({ current_bid_cents: 5000, current_bidder_account_id: 'u1' }, 5000)).toBe('sold');
    expect(decideLotOutcome({ current_bid_cents: 5000, current_bidder_account_id: 'u1' }, null)).toBe('sold');
  });

  it('passes with no bids or under the reserve', () => {
    expect(decideLotOutcome({ current_bid_cents: null, current_bidder_account_id: null }, null)).toBe('passed');
    expect(decideLotOutcome({ current_bid_cents: 4000, current_bidder_account_id: 'u1' }, 5000)).toBe('passed');
  });
});

describe('lotEndTimes', () => {
  it('staggers lots after the auction end', () => {
    const t = lotEndTimes(new Date('2026-11-20T18:00:00Z'), 3, 60).map((d) => d.toISOString());
    expect(t).toEqual(['2026-11-20T18:00:00.000Z', '2026-11-20T18:01:00.000Z', '2026-11-20T18:02:00.000Z']);
  });
});

describe('auctionPhase', () => {
  const a = {
    status: 'published',
    published_at: '2026-11-01T00:00:00Z',
    starts_at: '2026-11-10T00:00:00Z',
    ends_at: '2026-11-20T00:00:00Z',
  };

  it('walks draft → upcoming → live → closed', () => {
    expect(auctionPhase({ ...a, status: 'draft', published_at: null }, new Date('2026-11-15'))).toBe('draft');
    expect(auctionPhase(a, new Date('2026-11-05'))).toBe('upcoming');
    expect(auctionPhase(a, new Date('2026-11-15'))).toBe('live');
    expect(auctionPhase(a, new Date('2026-11-21'))).toBe('closed');
  });

  it('stays live while a staggered or extended lot is still open', () => {
    expect(auctionPhase(a, new Date('2026-11-20T00:05:00Z'), '2026-11-20T00:10:00Z')).toBe('live');
  });

  it('honours stored closed / cancelled', () => {
    expect(auctionPhase({ ...a, status: 'cancelled' }, new Date('2026-11-15'))).toBe('cancelled');
    expect(auctionPhase({ ...a, status: 'closed' }, new Date('2026-11-15'))).toBe('closed');
  });
});

describe('defaultStartPriceCents', () => {
  it('is half the list price rounded down to the increment', () => {
    expect(defaultStartPriceCents(250_000)).toBe(120_000);
    expect(defaultStartPriceCents(30_000)).toBe(15_000);
    expect(defaultStartPriceCents(null)).toBe(0);
  });
});

describe('parseMoneyToCents', () => {
  it('accepts dollar amounts with symbols and commas', () => {
    expect(parseMoneyToCents('$1,250')).toBe(125_000);
    expect(parseMoneyToCents('12.5')).toBe(1_250);
    expect(parseMoneyToCents(3)).toBe(300);
  });

  it('rejects junk and negatives', () => {
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('-5')).toBeNull();
    expect(parseMoneyToCents('1.234')).toBeNull();
    expect(parseMoneyToCents('')).toBeNull();
  });
});

describe('bidderLabels', () => {
  it('numbers bidders by first bid and calls the viewer You', () => {
    const labels = bidderLabels(
      [
        { bidder_account_id: 'b', created_at: '2026-11-10T02:00:00Z' },
        { bidder_account_id: 'a', created_at: '2026-11-10T01:00:00Z' },
        { bidder_account_id: 'a', created_at: '2026-11-10T03:00:00Z' },
        { bidder_account_id: 'me', created_at: '2026-11-10T04:00:00Z' },
      ],
      'me',
    );
    expect(labels.get('a')).toBe('Bidder 1');
    expect(labels.get('b')).toBe('Bidder 2');
    expect(labels.get('me')).toBe('You');
  });
});

describe('viewerLotStatus', () => {
  it('reports leading / outbid / won / lost', () => {
    expect(viewerLotStatus({ status: 'open', current_bidder_account_id: 'me' }, 'me', true)).toBe('leading');
    expect(viewerLotStatus({ status: 'open', current_bidder_account_id: 'x' }, 'me', true)).toBe('outbid');
    expect(viewerLotStatus({ status: 'sold', current_bidder_account_id: 'me' }, 'me', true)).toBe('won');
    expect(viewerLotStatus({ status: 'passed', current_bidder_account_id: 'me' }, 'me', true)).toBe('lost');
    expect(viewerLotStatus({ status: 'open', current_bidder_account_id: 'x' }, 'me', false)).toBeNull();
  });
});

describe('bidErrorMessage', () => {
  it('includes the minimum on a low bid', () => {
    expect(bidErrorMessage('bid_too_low', 65_000)).toBe('Your bid is below the minimum: bid at least $650');
    expect(bidErrorMessage('weird')).toBe('Could not place your bid');
  });
});
