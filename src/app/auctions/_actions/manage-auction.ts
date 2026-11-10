'use server';

import { revalidatePath } from 'next/cache';

import { logger } from '~/lib/logger';
import { createNotification } from '~/lib/notifications';
import { lotEndTimes, parseMoneyToCents } from '~/lib/auctions/bid-rules';

import { adminDb, canAuctionArtwork, canManageAuction, getViewer, loadAuction, type AuctionRecord } from '../_lib/auction-access';

type Ok = { success: true };
type Fail = { success: false; error: string };

async function requireManager(auctionId: string): Promise<{ auction: AuctionRecord; userId: string } | Fail> {
  const viewer = await getViewer();
  if (!viewer) return { success: false, error: 'You must be signed in' };
  const auction = await loadAuction(auctionId);
  if (!auction) return { success: false, error: 'Auction not found' };
  if (!(await canManageAuction(viewer.id, auction))) return { success: false, error: 'Only the organizer can do that' };
  return { auction, userId: viewer.id };
}

function revalidate(auction: Pick<AuctionRecord, 'id' | 'exhibition_id'>) {
  revalidatePath('/auctions');
  revalidatePath(`/auctions/${auction.id}`);
  revalidatePath(`/auctions/${auction.id}/manage`);
  if (auction.exhibition_id) revalidatePath(`/exhibitions/${auction.exhibition_id}`);
}

async function hasBids(auctionId: string) {
  const { count } = await adminDb()
    .from('auction_lots')
    .select('id', { count: 'exact', head: true })
    .eq('auction_id', auctionId)
    .gt('bid_count', 0);
  return (count ?? 0) > 0;
}

export interface UpdateAuctionInput {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  acceptsConsignments?: boolean;
  antiSnipeSeconds?: number;
  lotStaggerSeconds?: number;
}

export async function updateAuction(auctionId: string, input: UpdateAuctionInput): Promise<Ok | Fail> {
  const gate = await requireManager(auctionId);
  if ('success' in gate) return gate;
  const { auction } = gate;
  if (auction.status === 'closed' || auction.status === 'cancelled') {
    return { success: false, error: 'This auction has ended' };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) return { success: false, error: 'Give the auction a title' };
    patch.title = t;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.acceptsConsignments !== undefined) patch.accepts_consignments = input.acceptsConsignments;
  if (input.antiSnipeSeconds !== undefined) patch.anti_snipe_seconds = Math.max(0, Math.min(3600, Math.round(input.antiSnipeSeconds)));
  if (input.lotStaggerSeconds !== undefined) patch.lot_stagger_seconds = Math.max(0, Math.min(3600, Math.round(input.lotStaggerSeconds)));

  const timesChanged = input.startsAt !== undefined || input.endsAt !== undefined;
  if (timesChanged) {
    const live = auction.status === 'published' && (await hasBids(auction.id));
    if (live) return { success: false, error: "Times can't change once bidding has started" };
    const starts = new Date(input.startsAt ?? auction.starts_at);
    const ends = new Date(input.endsAt ?? auction.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return { success: false, error: 'Invalid date' };
    if (ends <= starts) return { success: false, error: 'The auction must end after it starts' };
    patch.starts_at = starts.toISOString();
    patch.ends_at = ends.toISOString();
  }

  const db = adminDb();
  const { error } = await db.from('auctions').update(patch).eq('id', auction.id);
  if (error) {
    logger.error('update_auction_failed', { auctionId, error });
    return { success: false, error: 'Could not save the auction' };
  }
  if (auction.status === 'published' && (timesChanged || input.lotStaggerSeconds !== undefined)) {
    await scheduleLots(auction.id);
  }
  revalidate(auction);
  return { success: true };
}

/** Give each open lot its closing time, in lot order, staggered after the auction end. */
async function scheduleLots(auctionId: string) {
  const db = adminDb();
  const { data: a } = await db.from('auctions').select('ends_at, lot_stagger_seconds').eq('id', auctionId).single();
  const { data: lots } = await db
    .from('auction_lots')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('status', 'open')
    .order('lot_number', { ascending: true });
  const times = lotEndTimes(new Date(a!.ends_at as string), lots?.length ?? 0, a!.lot_stagger_seconds as number);
  await Promise.all(
    ((lots ?? []) as Array<{ id: string }>).map((l, i) =>
      db.from('auction_lots').update({ ends_at: times[i]!.toISOString() }).eq('id', l.id).eq('bid_count', 0),
    ),
  );
}

export interface LotInput {
  startPrice?: string | number | null;
  reserve?: string | number | null;
  increment?: string | number | null;
}

export async function updateLot(lotId: string, input: LotInput): Promise<Ok | Fail> {
  const db = adminDb();
  const { data: lot } = await db
    .from('auction_lots')
    .select('id, auction_id, status, bid_count')
    .eq('id', lotId)
    .maybeSingle();
  if (!lot) return { success: false, error: 'Lot not found' };
  const gate = await requireManager(lot.auction_id as string);
  if ('success' in gate) return gate;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.startPrice !== undefined) {
    if ((lot.bid_count as number) > 0) return { success: false, error: "The start price can't change after a bid" };
    const cents = parseMoneyToCents(input.startPrice ?? '0');
    if (cents == null) return { success: false, error: 'Enter a valid start price' };
    patch.start_price_cents = cents;
  }
  if (input.increment !== undefined) {
    if (input.increment === null || input.increment === '') patch.increment_cents = null;
    else {
      const cents = parseMoneyToCents(input.increment);
      if (!cents) return { success: false, error: 'Enter a valid increment' };
      patch.increment_cents = cents;
    }
  }
  const { error } = await db.from('auction_lots').update(patch).eq('id', lotId);
  if (error) return { success: false, error: 'Could not save the lot' };

  if (input.reserve !== undefined) {
    if ((lot.bid_count as number) > 0) {
      // Lowering a reserve mid-auction is fair to bidders; raising it isn't.
      const { data: cur } = await db.from('auction_lot_reserves').select('reserve_cents').eq('lot_id', lotId).maybeSingle();
      const next = input.reserve === null || input.reserve === '' ? null : parseMoneyToCents(input.reserve);
      if (cur && next != null && next > (cur.reserve_cents as number)) {
        return { success: false, error: "A reserve can only be lowered once bidding has started" };
      }
      if (!cur && next != null) return { success: false, error: "A reserve can't be added once bidding has started" };
    }
    if (input.reserve === null || input.reserve === '') {
      await db.from('auction_lot_reserves').delete().eq('lot_id', lotId);
    } else {
      const cents = parseMoneyToCents(input.reserve);
      if (cents == null) return { success: false, error: 'Enter a valid reserve' };
      await db.from('auction_lot_reserves').upsert({ lot_id: lotId, reserve_cents: cents });
    }
  }
  revalidate(gate.auction);
  return { success: true };
}

export async function addLots(
  auctionId: string,
  lots: Array<{ artworkId: string; startPrice?: string | number | null; reserve?: string | number | null }>,
): Promise<Ok | Fail> {
  const gate = await requireManager(auctionId);
  if ('success' in gate) return gate;
  const { auction, userId } = gate;
  if (auction.status === 'closed' || auction.status === 'cancelled') return { success: false, error: 'This auction has ended' };

  const db = adminDb();
  const ids = [...new Set(lots.map((l) => l.artworkId))];
  if (!ids.length) return { success: true };
  const { data: arts } = await db.from('artworks').select('id, account_id, gallery_profile_id, is_sold').in('id', ids);
  for (const art of (arts ?? []) as Array<{ id: string; account_id: string | null; gallery_profile_id: string | null; is_sold: boolean | null }>) {
    if (art.is_sold) return { success: false, error: 'One of the works is already sold' };
    if (!(await canAuctionArtwork(userId, art))) return { success: false, error: 'You can only add works you or your team hold' };
  }
  if ((arts ?? []).length !== ids.length) return { success: false, error: 'One of the works was not found' };

  const { data: last } = await db
    .from('auction_lots')
    .select('lot_number')
    .eq('auction_id', auctionId)
    .order('lot_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  let n = (last?.lot_number as number | undefined) ?? 0;

  const { data: inserted, error } = await db
    .from('auction_lots')
    .insert(
      lots.map((l) => ({
        auction_id: auctionId,
        artwork_id: l.artworkId,
        lot_number: ++n,
        consignor_account_id: userId,
        status: 'open',
        start_price_cents: parseMoneyToCents(l.startPrice ?? '0') ?? 0,
      })),
    )
    .select('id, artwork_id');
  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'One of the works is already in another auction' : 'Could not add the works',
    };
  }
  const lotBy = new Map(((inserted ?? []) as Array<{ id: string; artwork_id: string }>).map((r) => [r.artwork_id, r.id]));
  const reserves = lots
    .map((l) => ({ lot_id: lotBy.get(l.artworkId), reserve_cents: l.reserve ? parseMoneyToCents(l.reserve) : null }))
    .filter((r) => r.lot_id && r.reserve_cents);
  if (reserves.length) await db.from('auction_lot_reserves').insert(reserves);

  if (auction.status === 'published') await scheduleLots(auctionId);
  revalidate(auction);
  return { success: true };
}

/** Withdraw a lot. Allowed until it has a bid. */
export async function withdrawLot(lotId: string): Promise<Ok | Fail> {
  const db = adminDb();
  const { data: lot } = await db.from('auction_lots').select('id, auction_id, bid_count, status').eq('id', lotId).maybeSingle();
  if (!lot) return { success: false, error: 'Lot not found' };
  const gate = await requireManager(lot.auction_id as string);
  if ('success' in gate) return gate;
  if ((lot.bid_count as number) > 0) return { success: false, error: "A lot with bids can't be withdrawn" };
  if (gate.auction.status === 'draft') {
    await db.from('auction_lots').delete().eq('id', lotId);
  } else {
    await db.from('auction_lots').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', lotId);
  }
  revalidate(gate.auction);
  return { success: true };
}

/** Move a lot up or down one place. */
export async function moveLot(lotId: string, direction: 'up' | 'down'): Promise<Ok | Fail> {
  const db = adminDb();
  const { data: lot } = await db.from('auction_lots').select('id, auction_id, lot_number').eq('id', lotId).maybeSingle();
  if (!lot) return { success: false, error: 'Lot not found' };
  const gate = await requireManager(lot.auction_id as string);
  if ('success' in gate) return gate;
  if (gate.auction.status !== 'draft') return { success: false, error: 'Lots can only be reordered before publishing' };

  const { data: lots } = await db
    .from('auction_lots')
    .select('id, lot_number')
    .eq('auction_id', lot.auction_id)
    .in('status', ['open', 'pending'])
    .order('lot_number', { ascending: true });
  const list = (lots ?? []) as Array<{ id: string; lot_number: number }>;
  const i = list.findIndex((l) => l.id === lotId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { success: true };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await Promise.all(list.map((l, idx) => db.from('auction_lots').update({ lot_number: idx + 1 }).eq('id', l.id)));
  revalidate(gate.auction);
  return { success: true };
}

export async function publishAuction(auctionId: string): Promise<Ok | Fail> {
  const gate = await requireManager(auctionId);
  if ('success' in gate) return gate;
  const { auction } = gate;
  if (auction.status !== 'draft') return { success: false, error: 'This auction is already published' };
  if (new Date(auction.ends_at) <= new Date()) return { success: false, error: 'Set an end time in the future first' };

  const db = adminDb();
  const { count } = await db
    .from('auction_lots')
    .select('id', { count: 'exact', head: true })
    .eq('auction_id', auctionId)
    .eq('status', 'open');
  if (!count) return { success: false, error: 'Add at least one lot first' };

  const now = new Date().toISOString();
  const { error } = await db
    .from('auctions')
    .update({ status: 'published', published_at: now, updated_at: now })
    .eq('id', auctionId)
    .eq('status', 'draft');
  if (error) return { success: false, error: 'Could not publish the auction' };
  await scheduleLots(auctionId);
  revalidate(auction);
  return { success: true };
}

/** Cancel an auction that has no bids yet. Its works go back to being available. */
export async function cancelAuction(auctionId: string): Promise<Ok | Fail> {
  const gate = await requireManager(auctionId);
  if ('success' in gate) return gate;
  const { auction } = gate;
  if (auction.status === 'closed' || auction.status === 'cancelled') return { success: false, error: 'This auction has ended' };
  if (await hasBids(auctionId)) return { success: false, error: "An auction with bids can't be cancelled" };

  const db = adminDb();
  const now = new Date().toISOString();
  await db.from('auction_lots').update({ status: 'withdrawn', updated_at: now }).eq('auction_id', auctionId).in('status', ['open', 'pending']);
  await db.from('auctions').update({ status: 'cancelled', updated_at: now }).eq('id', auctionId);
  revalidate(auction);
  return { success: true };
}

/** Delete a draft outright. */
export async function deleteDraftAuction(auctionId: string): Promise<Ok | Fail> {
  const gate = await requireManager(auctionId);
  if ('success' in gate) return gate;
  if (gate.auction.status !== 'draft') return { success: false, error: 'Only drafts can be deleted; cancel it instead' };
  await adminDb().from('auctions').delete().eq('id', auctionId);
  revalidate(gate.auction);
  return { success: true };
}

/** Approve or decline a consigned work. */
export async function reviewConsignment(
  lotId: string,
  approve: boolean,
  input: { startPrice?: string | number | null } = {},
): Promise<Ok | Fail> {
  const db = adminDb();
  const { data: lot } = await db
    .from('auction_lots')
    .select('id, auction_id, artwork_id, status, consignor_account_id')
    .eq('id', lotId)
    .maybeSingle();
  if (!lot) return { success: false, error: 'Lot not found' };
  const gate = await requireManager(lot.auction_id as string);
  if ('success' in gate) return gate;
  if (lot.status !== 'pending') return { success: false, error: 'This consignment was already reviewed' };

  const patch: Record<string, unknown> = { status: approve ? 'open' : 'declined', updated_at: new Date().toISOString() };
  if (approve && input.startPrice !== undefined && input.startPrice !== null && input.startPrice !== '') {
    const cents = parseMoneyToCents(input.startPrice);
    if (cents == null) return { success: false, error: 'Enter a valid start price' };
    patch.start_price_cents = cents;
  }
  if (approve) {
    const { data: last } = await db
      .from('auction_lots')
      .select('lot_number')
      .eq('auction_id', lot.auction_id)
      .in('status', ['open', 'sold', 'passed'])
      .order('lot_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    patch.lot_number = ((last?.lot_number as number | undefined) ?? 0) + 1;
  }
  const { error } = await db.from('auction_lots').update(patch).eq('id', lotId).eq('status', 'pending');
  if (error) return { success: false, error: 'Could not review the consignment' };
  if (approve && gate.auction.status === 'published') await scheduleLots(gate.auction.id);

  const { data: art } = await db.from('artworks').select('title').eq('id', lot.artwork_id).maybeSingle();
  try {
    await createNotification({
      userId: lot.consignor_account_id as string,
      type: 'auction_consignment_reviewed',
      title: approve ? 'Consignment accepted' : 'Consignment declined',
      message: approve
        ? `"${art?.title || 'Your work'}" will be offered in ${gate.auction.title}.`
        : `"${art?.title || 'Your work'}" won't be offered in ${gate.auction.title}.`,
      artworkId: lot.artwork_id as string,
      metadata: { auction_id: gate.auction.id, lot_id: lotId },
    });
  } catch (err) {
    logger.error('auction_consignment_review_notify_failed', { lotId, error: err });
  }
  revalidate(gate.auction);
  return { success: true };
}
