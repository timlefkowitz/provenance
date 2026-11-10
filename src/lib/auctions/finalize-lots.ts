import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createNotification } from '~/lib/notifications';
import { sendNotificationEmail, isEmailConfigured } from '~/lib/email';
import { logger } from '~/lib/logger';
import { recordSale } from '~/lib/sales/record-sale';
import { createArtworkTransferInvite } from '~/lib/sales/create-transfer-invite';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';

import { decideLotOutcome, formatCents } from './bid-rules';

type OverdueLot = {
  id: string;
  auction_id: string;
  artwork_id: string;
  lot_number: number;
  consignor_account_id: string;
  current_bid_cents: number | null;
  current_bidder_account_id: string | null;
  bid_count: number;
};

type AuctionRow = {
  id: string;
  title: string;
  currency: string;
  organizer_account_id: string;
  exhibition_id: string | null;
  status: string;
  ends_at: string;
};

export interface FinalizeResult {
  closed: number;
  sold: number;
  passed: number;
  salesRecorded: number;
  auctionsClosed: number;
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';

async function notifyQuietly(params: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(params);
  } catch (err) {
    logger.error('auction_notification_failed', { type: params.type, userId: params.userId, error: err });
  }
}

async function loadAccount(db: UntypedSupabaseClient, id: string) {
  const { data } = await db.from('accounts').select('id, name, email').eq('id', id).maybeSingle();
  return (data ?? null) as { id: string; name: string | null; email: string | null } | null;
}

/**
 * Close every open lot whose time has run out (for one auction, or all of
 * them), record a sale for each lot that met its reserve, and mark auctions
 * closed once nothing is left open. Safe to run concurrently and repeatedly:
 * each lot is claimed with a conditional update, so it is settled once.
 */
export async function finalizeOverdueLots(
  admin: SupabaseClient | UntypedSupabaseClient,
  opts: { auctionId?: string } = {},
): Promise<FinalizeResult> {
  const db = asUntyped(admin);
  const result: FinalizeResult = { closed: 0, sold: 0, passed: 0, salesRecorded: 0, auctionsClosed: 0 };
  const nowIso = new Date().toISOString();

  let q = db
    .from('auction_lots')
    .select('id, auction_id, artwork_id, lot_number, consignor_account_id, current_bid_cents, current_bidder_account_id, bid_count')
    .eq('status', 'open')
    .lt('ends_at', nowIso)
    .limit(200);
  if (opts.auctionId) q = q.eq('auction_id', opts.auctionId);
  const { data: overdue, error } = await q;
  if (error) {
    logger.error('auction_finalize_load_failed', { error });
    return result;
  }

  const lots = (overdue ?? []) as OverdueLot[];
  const touchedAuctions = new Set<string>(opts.auctionId ? [opts.auctionId] : []);

  if (lots.length) {
    const { data: reserves } = await db
      .from('auction_lot_reserves')
      .select('lot_id, reserve_cents')
      .in('lot_id', lots.map((l) => l.id));
    const reserveBy = new Map(
      ((reserves ?? []) as Array<{ lot_id: string; reserve_cents: number }>).map((r) => [r.lot_id, r.reserve_cents]),
    );

    for (const lot of lots) {
      const outcome = decideLotOutcome(lot, reserveBy.get(lot.id) ?? null);
      // bid_count guards against a bid that committed after we read the lot.
      const { data: claimed } = await db
        .from('auction_lots')
        .update({ status: outcome, closed_at: nowIso, updated_at: nowIso })
        .eq('id', lot.id)
        .eq('status', 'open')
        .eq('bid_count', lot.bid_count)
        .lt('ends_at', nowIso)
        .select('id');
      if (!claimed?.length) continue;
      result.closed += 1;
      result[outcome] += 1;
      touchedAuctions.add(lot.auction_id);
    }
  }

  // Record sales for sold lots not yet settled (including retries of earlier failures).
  let soldQ = db
    .from('auction_lots')
    .select('id, auction_id, artwork_id, lot_number, consignor_account_id, current_bid_cents, current_bidder_account_id, bid_count')
    .eq('status', 'sold')
    .is('sale_recorded_at', null)
    .limit(100);
  if (opts.auctionId) soldQ = soldQ.eq('auction_id', opts.auctionId);
  const { data: unsettled } = await soldQ;

  const auctionCache = new Map<string, AuctionRow | null>();
  const getAuction = async (id: string) => {
    if (!auctionCache.has(id)) {
      const { data } = await db
        .from('auctions')
        .select('id, title, currency, organizer_account_id, exhibition_id, status, ends_at')
        .eq('id', id)
        .maybeSingle();
      auctionCache.set(id, (data ?? null) as AuctionRow | null);
    }
    return auctionCache.get(id) ?? null;
  };

  for (const lot of (unsettled ?? []) as OverdueLot[]) {
    touchedAuctions.add(lot.auction_id);
    if (!(await settleSoldLot(admin, db, lot, await getAuction(lot.auction_id)))) continue;
    result.salesRecorded += 1;
  }

  // Tell consignors about lots that passed in this run.
  for (const lot of lots) {
    const { data: row } = await db.from('auction_lots').select('status').eq('id', lot.id).maybeSingle();
    if (row?.status !== 'passed') continue;
    const auction = await getAuction(lot.auction_id);
    if (!auction) continue;
    const title = await artworkTitle(db, lot.artwork_id);
    const recipients = new Set([lot.consignor_account_id, auction.organizer_account_id]);
    for (const userId of recipients) {
      await notifyQuietly({
        userId,
        type: 'auction_lot_passed',
        title: `Lot ${lot.lot_number} passed`,
        message: lot.current_bid_cents
          ? `"${title}" closed at ${formatCents(lot.current_bid_cents, auction.currency)}, below its reserve, in ${auction.title}.`
          : `"${title}" closed without bids in ${auction.title}.`,
        artworkId: lot.artwork_id,
        metadata: { auction_id: auction.id, lot_id: lot.id },
      });
    }
  }

  // Close auctions that have nothing left open.
  for (const auctionId of touchedAuctions) {
    const auction = await getAuction(auctionId);
    if (!auction || auction.status !== 'published' || auction.ends_at > nowIso) continue;
    const { count } = await db
      .from('auction_lots')
      .select('id', { count: 'exact', head: true })
      .eq('auction_id', auctionId)
      .eq('status', 'open');
    if ((count ?? 0) > 0) continue;
    // Consignments still waiting for review when the sale ends are declined.
    await db
      .from('auction_lots')
      .update({ status: 'declined', updated_at: nowIso })
      .eq('auction_id', auctionId)
      .eq('status', 'pending');
    const { data: closed } = await db
      .from('auctions')
      .update({ status: 'closed', updated_at: nowIso })
      .eq('id', auctionId)
      .eq('status', 'published')
      .select('id');
    if (closed?.length) result.auctionsClosed += 1;
  }

  if (result.closed || result.salesRecorded || result.auctionsClosed) {
    console.log('[Auctions] finalizeOverdueLots', { auctionId: opts.auctionId ?? 'all', ...result });
  }
  return result;
}

async function artworkTitle(db: UntypedSupabaseClient, artworkId: string): Promise<string> {
  const { data } = await db.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  return (data?.title as string) || 'Untitled';
}

async function settleSoldLot(
  admin: SupabaseClient | UntypedSupabaseClient,
  db: UntypedSupabaseClient,
  lot: OverdueLot,
  auction: AuctionRow | null,
): Promise<boolean> {
  if (!auction || !lot.current_bidder_account_id || lot.current_bid_cents == null) return false;

  const claimedAt = new Date().toISOString();
  const { data: claim } = await db
    .from('auction_lots')
    .update({ sale_recorded_at: claimedAt })
    .eq('id', lot.id)
    .is('sale_recorded_at', null)
    .select('id');
  if (!claim?.length) return false;

  const winner = await loadAccount(db, lot.current_bidder_account_id);
  const title = await artworkTitle(db, lot.artwork_id);

  const sale = await recordSale(admin as SupabaseClient, {
    artworkId: lot.artwork_id,
    buyer: {
      accountId: lot.current_bidder_account_id,
      email: winner?.email ?? null,
      name: winner?.name ?? null,
    },
    priceCents: lot.current_bid_cents,
    currency: auction.currency,
    soldAt: claimedAt,
    recordedBy: lot.consignor_account_id,
    notes: `Auction: ${auction.title}, lot ${lot.lot_number}`,
    metadata: {
      source: 'auction',
      auction_id: auction.id,
      lot_id: lot.id,
      ...(auction.exhibition_id ? { exhibition_id: auction.exhibition_id } : {}),
    },
  });

  if (!sale.success) {
    logger.error('auction_record_sale_failed', { lotId: lot.id, error: sale.error });
    await db.from('auction_lots').update({ sale_recorded_at: null }).eq('id', lot.id);
    return false;
  }

  // Certificate of Ownership invite to the winner, from the seller of record.
  try {
    const { data: art } = await db.from('artworks').select('account_id').eq('id', lot.artwork_id).maybeSingle();
    const invite = await createArtworkTransferInvite({
      artworkId: lot.artwork_id,
      sellerUserId: lot.consignor_account_id,
      sellerAccountId: (art?.account_id as string) ?? null,
      buyerEmail: winner?.email ?? null,
      buyerAccountId: lot.current_bidder_account_id,
      buyerName: winner?.name ?? null,
      workTitle: title,
    });
    if (invite.errors.length) {
      logger.error('auction_transfer_invite_errors', { lotId: lot.id, errors: invite.errors });
    }
  } catch (err) {
    logger.error('auction_transfer_invite_failed', { lotId: lot.id, error: err });
  }

  const price = formatCents(lot.current_bid_cents, auction.currency);
  const auctionUrl = `${siteUrl()}/auctions/${auction.id}`;

  await notifyQuietly({
    userId: lot.current_bidder_account_id,
    type: 'auction_won',
    title: `You won lot ${lot.lot_number}`,
    message: `Your bid of ${price} won "${title}" in ${auction.title}. The seller will be in touch about payment, and your Certificate of Ownership invite is on its way.`,
    artworkId: lot.artwork_id,
    metadata: { auction_id: auction.id, lot_id: lot.id, price_cents: lot.current_bid_cents },
  });

  if (winner?.email && isEmailConfigured()) {
    try {
      await sendNotificationEmail(winner.email, winner.name || 'there', `You won "${title}"`, {
        title: `You won lot ${lot.lot_number}`,
        body: `Your bid of ${price} won "${title}" in ${auction.title}. The seller will contact you to arrange payment and delivery. We've also sent your Certificate of Ownership invite.`,
        ctaUrl: auctionUrl,
        ctaLabel: 'View auction',
      });
    } catch (err) {
      logger.error('auction_won_email_failed', { lotId: lot.id, error: err });
    }
  }

  const sellers = new Set([lot.consignor_account_id, auction.organizer_account_id]);
  for (const userId of sellers) {
    await notifyQuietly({
      userId,
      type: 'auction_lot_sold',
      title: `Lot ${lot.lot_number} sold for ${price}`,
      message: `"${title}" sold to ${winner?.name || 'the high bidder'} in ${auction.title}. Arrange payment with the buyer${winner?.email ? ` at ${winner.email}` : ''}.`,
      artworkId: lot.artwork_id,
      relatedUserId: lot.current_bidder_account_id,
      metadata: { auction_id: auction.id, lot_id: lot.id, price_cents: lot.current_bid_cents },
    });
  }

  return true;
}
