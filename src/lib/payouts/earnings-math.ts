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

/**
 * Split `total` into integer parts proportional to `weights`, so the parts
 * always add up to exactly `total` (largest-remainder rounding).
 */
export function allocateProRata(total: number, weights: number[]): number[] {
  const t = Math.max(0, Math.round(total));
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? t : 0));
  const exact = weights.map((w) => (t * Math.max(0, w)) / sum);
  const parts = exact.map(Math.floor);
  let left = t - parts.reduce((a, p) => a + p, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i]! += 1;
    left -= 1;
  }
  return parts;
}

export type OrderItemForSplit = {
  orderItemId: string;
  artworkId: string;
  priceCents: number;
  artistAccountId: string;
  galleryAccountId: string | null;
  commissionPercent: number;
};

export type OrderEarningLine = EarningSplit & {
  orderItemId: string;
  artworkId: string;
  sellerAccountId: string;
  role: 'artist' | 'gallery_commission';
};

/**
 * Turn a paid cart into earnings lines. Stripe's fee is shared across works by
 * price. Within a work, the gallery's commission is a share of the sale price,
 * and both the platform fee and Stripe's fee are shared between artist and
 * gallery in the same proportion. A gallery selling its own work, or a show
 * with no commission, gives one artist line for the work.
 */
export function splitOrder(
  items: OrderItemForSplit[],
  totalStripeFeeCents: number,
  feePercent: number,
): OrderEarningLine[] {
  const itemFees = allocateProRata(
    totalStripeFeeCents,
    items.map((i) => i.priceCents),
  );
  const lines: OrderEarningLine[] = [];
  items.forEach((item, idx) => {
    const price = Math.max(0, Math.round(item.priceCents));
    const pct = Math.min(100, Math.max(0, item.commissionPercent || 0));
    const hasGallery =
      !!item.galleryAccountId && item.galleryAccountId !== item.artistAccountId && pct > 0;
    const galleryGross = hasGallery ? Math.round((price * pct) / 100) : 0;
    const artistGross = price - galleryGross;
    const [artistFee, galleryFee] = allocateProRata(itemFees[idx] ?? 0, [artistGross, galleryGross]);

    lines.push({
      ...splitEarning(artistGross, artistFee ?? 0, feePercent),
      orderItemId: item.orderItemId,
      artworkId: item.artworkId,
      sellerAccountId: item.artistAccountId,
      role: 'artist',
    });
    if (hasGallery && galleryGross > 0) {
      lines.push({
        ...splitEarning(galleryGross, galleryFee ?? 0, feePercent),
        orderItemId: item.orderItemId,
        artworkId: item.artworkId,
        sellerAccountId: item.galleryAccountId!,
        role: 'gallery_commission',
      });
    }
  });
  return lines;
}
