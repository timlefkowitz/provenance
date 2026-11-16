/**
 * Pure money math for seller payouts. Buyers pay Provenance; the seller gets
 * the price minus our platform fee minus Stripe's actual processing fee.
 */

export const DEFAULT_PLATFORM_FEE_PERCENT = 2.7;
export const DEFAULT_PAYOUT_HOLD_DAYS = 7;

export type EarningStatus = 'pending' | 'held' | 'transferred' | 'reversed';

export function platformFeePercent(raw: string | undefined = process.env.STRIPE_PLATFORM_FEE_PERCENT): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return DEFAULT_PLATFORM_FEE_PERCENT;
  return n;
}

export function payoutHoldDays(raw: string | undefined = process.env.SELLER_PAYOUT_HOLD_DAYS): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PAYOUT_HOLD_DAYS;
  return n;
}

export type EarningSplit = {
  grossCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
};

/** Split a gross charge into platform fee, Stripe fee and the seller's net. */
export function splitEarning(grossCents: number, stripeFeeCents: number, feePercent: number): EarningSplit {
  const gross = Math.max(0, Math.round(grossCents));
  const stripeFee = Math.max(0, Math.round(stripeFeeCents));
  const platformFee = Math.round((gross * feePercent) / 100);
  const net = Math.max(0, gross - platformFee - stripeFee);
  return { grossCents: gross, platformFeeCents: platformFee, stripeFeeCents: stripeFee, netCents: net };
}

/** Estimate of Stripe's US card fee (2.9% + 30¢), for showing sellers a preview before a sale. */
export function estimateStripeFeeCents(grossCents: number): number {
  return Math.round(grossCents * 0.029) + 30;
}

export function releaseAt(from: Date, holdDays: number): Date {
  return new Date(from.getTime() + holdDays * 24 * 60 * 60 * 1000);
}

/** Whether an earning is ready to be transferred to the seller right now. */
export function isDueForTransfer(
  earning: { status: EarningStatus; release_at: string; net_cents: number },
  payoutsEnabled: boolean,
  now: Date = new Date(),
): boolean {
  return (
    earning.status === 'pending' &&
    payoutsEnabled &&
    earning.net_cents > 0 &&
    new Date(earning.release_at).getTime() <= now.getTime()
  );
}

/**
 * Next status after a refund or dispute. Untransferred money is simply held;
 * transferred money needs the transfer reversed first.
 */
export function statusAfterRefundOrDispute(current: EarningStatus): {
  next: EarningStatus;
  reverseTransfer: boolean;
} {
  switch (current) {
    case 'pending':
      return { next: 'held', reverseTransfer: false };
    case 'transferred':
      return { next: 'reversed', reverseTransfer: true };
    default:
      return { next: current, reverseTransfer: false };
  }
}

export function summarizeEarnings(rows: Array<{ status: EarningStatus; net_cents: number }>) {
  const totals = { pending: 0, held: 0, transferred: 0, reversed: 0 };
  for (const r of rows) totals[r.status] += r.net_cents;
  return totals;
}
