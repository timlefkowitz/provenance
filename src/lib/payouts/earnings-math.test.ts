import { describe, expect, it } from 'vitest';

import {
  isDueForTransfer,
  payoutHoldDays,
  platformFeePercent,
  releaseAt,
  splitEarning,
  statusAfterRefundOrDispute,
  summarizeEarnings,
} from './earnings-math';

describe('splitEarning', () => {
  it('takes 2.7% and the Stripe fee from a $1,000 sale', () => {
    // Stripe: 2.9% + 30¢ = 2930
    expect(splitEarning(100000, 2930, 2.7)).toEqual({
      grossCents: 100000,
      platformFeeCents: 2700,
      stripeFeeCents: 2930,
      netCents: 94370,
    });
  });

  it('rounds the platform fee to the nearest cent', () => {
    // 2.7% of 1999 = 53.973
    expect(splitEarning(1999, 88, 2.7).platformFeeCents).toBe(54);
    expect(splitEarning(1999, 88, 2.7).netCents).toBe(1999 - 54 - 88);
  });

  it('never goes negative on tiny sales', () => {
    expect(splitEarning(50, 31, 2.7).netCents).toBe(18);
    expect(splitEarning(20, 31, 2.7).netCents).toBe(0);
  });
});

describe('env parsing', () => {
  it('defaults the fee to 2.7% and the hold to 7 days', () => {
    expect(platformFeePercent(undefined)).toBe(2.7);
    expect(platformFeePercent('nope')).toBe(2.7);
    expect(platformFeePercent('5')).toBe(5);
    expect(payoutHoldDays(undefined)).toBe(7);
    expect(payoutHoldDays('0')).toBe(0);
  });
});

describe('isDueForTransfer', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const base = { status: 'pending' as const, net_cents: 1000, release_at: '2026-11-20T11:00:00Z' };

  it('is due once released and payouts are enabled', () => {
    expect(isDueForTransfer(base, true, now)).toBe(true);
  });

  it('waits for the hold, payout details, and a pending status', () => {
    expect(isDueForTransfer({ ...base, release_at: releaseAt(now, 1).toISOString() }, true, now)).toBe(false);
    expect(isDueForTransfer(base, false, now)).toBe(false);
    expect(isDueForTransfer({ ...base, status: 'held' }, true, now)).toBe(false);
    expect(isDueForTransfer({ ...base, net_cents: 0 }, true, now)).toBe(false);
  });
});

describe('statusAfterRefundOrDispute', () => {
  it('holds untransferred money and reverses transferred money', () => {
    expect(statusAfterRefundOrDispute('pending')).toEqual({ next: 'held', reverseTransfer: false });
    expect(statusAfterRefundOrDispute('transferred')).toEqual({ next: 'reversed', reverseTransfer: true });
    expect(statusAfterRefundOrDispute('held')).toEqual({ next: 'held', reverseTransfer: false });
  });
});

describe('summarizeEarnings', () => {
  it('totals net cents by status', () => {
    expect(
      summarizeEarnings([
        { status: 'pending', net_cents: 100 },
        { status: 'pending', net_cents: 50 },
        { status: 'transferred', net_cents: 900 },
      ]),
    ).toEqual({ pending: 150, held: 0, transferred: 900, reversed: 0 });
  });
});
