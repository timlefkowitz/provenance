/**
 * Pure auction rules shared by the server actions and the bid UI.
 * The increment ladder and minimum-bid rule are mirrored in SQL by
 * auction_bid_increment() / place_auction_bid() in the auctions migration;
 * keep them in step (bid-rules.test.ts pins the shared cases).
 */

export const AUCTION_STATUSES = ['draft', 'published', 'closed', 'cancelled'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const LOT_STATUSES = ['pending', 'declined', 'withdrawn', 'open', 'sold', 'passed'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

/** The smallest a first bid may be (one dollar), whatever the start price. */
export const MIN_FIRST_BID_CENTS = 100;
export const DEFAULT_LOT_STAGGER_SECONDS = 60;
export const DEFAULT_ANTI_SNIPE_SECONDS = 120;
export const MAX_LOTS_PER_AUCTION = 300;

/** Default increment for a lot whose current bid is `currentCents`. */
export function incrementFor(currentCents: number): number {
  if (currentCents < 50_000) return 2_500;
  if (currentCents < 100_000) return 5_000;
  if (currentCents < 500_000) return 10_000;
  if (currentCents < 1_000_000) return 25_000;
  if (currentCents < 5_000_000) return 50_000;
  return 100_000;
}

export interface LotBidState {
  start_price_cents: number;
  increment_cents?: number | null;
  current_bid_cents?: number | null;
}

/** The lowest bid the lot will accept next. */
export function nextMinimumBid(lot: LotBidState): number {
  if (lot.current_bid_cents == null) {
    return Math.max(lot.start_price_cents, MIN_FIRST_BID_CENTS);
  }
  return lot.current_bid_cents + (lot.increment_cents || incrementFor(lot.current_bid_cents));
}

/**
 * A bid landing inside the last `windowSeconds` pushes the lot's close out to
 * `now + windowSeconds`, so nobody can win by bidding in the final second.
 */
export function extendForAntiSnipe(
  endsAt: Date,
  now: Date,
  windowSeconds: number,
): { endsAt: Date; extended: boolean } {
  if (windowSeconds <= 0) return { endsAt, extended: false };
  const windowMs = windowSeconds * 1000;
  if (endsAt.getTime() - now.getTime() < windowMs) {
    return { endsAt: new Date(now.getTime() + windowMs), extended: true };
  }
  return { endsAt, extended: false };
}

export function reserveMet(currentBidCents: number | null | undefined, reserveCents: number | null | undefined): boolean {
  if (currentBidCents == null) return false;
  if (reserveCents == null) return true;
  return currentBidCents >= reserveCents;
}

export type LotOutcome = 'sold' | 'passed';

/** A closed lot sells to the high bidder if there was a bid that met the reserve. */
export function decideLotOutcome(
  lot: { current_bid_cents?: number | null; current_bidder_account_id?: string | null },
  reserveCents: number | null | undefined,
): LotOutcome {
  if (!lot.current_bidder_account_id || lot.current_bid_cents == null) return 'passed';
  return reserveMet(lot.current_bid_cents, reserveCents) ? 'sold' : 'passed';
}

/** Closing time for each lot in order: the first closes at the auction end, the rest `stagger` apart. */
export function lotEndTimes(auctionEnd: Date, count: number, staggerSeconds: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(auctionEnd.getTime() + i * Math.max(0, staggerSeconds) * 1000));
  }
  return out;
}

export type AuctionPhase = 'draft' | 'upcoming' | 'live' | 'closed' | 'cancelled';

/**
 * Where an auction stands. `lastLotEndsAt` is the latest close of its open
 * lots (lots run past the nominal end because of stagger and extensions).
 */
export function auctionPhase(
  auction: { status: string; published_at?: string | null; starts_at: string; ends_at: string },
  now: Date,
  lastLotEndsAt?: string | null,
): AuctionPhase {
  if (auction.status === 'cancelled') return 'cancelled';
  if (auction.status === 'closed') return 'closed';
  if (auction.status === 'draft' || !auction.published_at) return 'draft';
  if (now < new Date(auction.starts_at)) return 'upcoming';
  const end = lastLotEndsAt && lastLotEndsAt > auction.ends_at ? lastLotEndsAt : auction.ends_at;
  if (now < new Date(end)) return 'live';
  return 'closed';
}

/** Suggested start price: half the list price, rounded down to the increment at that level. */
export function defaultStartPriceCents(listPriceCents: number | null | undefined): number {
  if (!listPriceCents || listPriceCents <= 0) return 0;
  const half = Math.floor(listPriceCents / 2);
  const step = incrementFor(half);
  return Math.max(step, Math.floor(half / step) * step);
}

/** "1,250" or "$1,250.50" from a user's input; null when it isn't a non-negative amount. */
export function parseMoneyToCents(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s,$€£]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '—';
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(whole ? 0 : 2)}`;
  }
}

const BID_ERRORS: Record<string, string> = {
  not_authenticated: 'Sign in to bid',
  lot_not_found: 'This lot no longer exists',
  auction_not_open: 'This auction is not open for bidding',
  auction_not_started: 'Bidding has not started yet',
  lot_closed: 'Bidding on this lot has closed',
  own_lot: "You can't bid on a lot in your own auction",
  already_leading: "You're already the high bidder",
  bid_too_low: 'Your bid is below the minimum',
  bid_too_high: 'That bid is too large',
};

export function bidErrorMessage(code: string | null | undefined, nextMinCents?: number | null, currency = 'USD'): string {
  const base = (code && BID_ERRORS[code]) || 'Could not place your bid';
  if (code === 'bid_too_low' && nextMinCents != null) {
    return `${base}: bid at least ${formatCents(nextMinCents, currency)}`;
  }
  return base;
}

/**
 * Stable anonymous names for bidders on a lot ("Bidder 1" is whoever bid
 * first). The viewer sees "You" for their own bids.
 */
export function bidderLabels(
  bids: Array<{ bidder_account_id: string; created_at: string }>,
  viewerId?: string | null,
): Map<string, string> {
  const ordered = [...bids].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const labels = new Map<string, string>();
  let n = 0;
  for (const b of ordered) {
    if (labels.has(b.bidder_account_id)) continue;
    n += 1;
    labels.set(b.bidder_account_id, b.bidder_account_id === viewerId ? 'You' : `Bidder ${n}`);
  }
  return labels;
}

export type ViewerLotStatus = 'leading' | 'outbid' | 'won' | 'lost' | null;

export function viewerLotStatus(
  lot: { status: string; current_bidder_account_id?: string | null },
  viewerId: string | null | undefined,
  viewerHasBid: boolean,
): ViewerLotStatus {
  if (!viewerId || !viewerHasBid) return null;
  const leading = lot.current_bidder_account_id === viewerId;
  if (lot.status === 'sold') return leading ? 'won' : 'lost';
  if (lot.status === 'passed') return 'lost';
  return leading ? 'leading' : 'outbid';
}
