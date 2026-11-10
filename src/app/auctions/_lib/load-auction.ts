import 'server-only';

import { finalizeOverdueLots } from '~/lib/auctions/finalize-lots';
import {
  auctionPhase,
  bidderLabels,
  nextMinimumBid,
  reserveMet,
  viewerLotStatus,
  type AuctionPhase,
  type ViewerLotStatus,
} from '~/lib/auctions/bid-rules';
import { logger } from '~/lib/logger';

import {
  AUCTION_SELECT,
  adminDb,
  canManageAuction,
  getViewer,
  loadAuction,
  type AuctionRecord,
} from './auction-access';

export type LotView = {
  id: string;
  lot_number: number;
  status: string;
  consignor_account_id: string;
  artwork: {
    id: string;
    title: string;
    artist_name: string | null;
    image_url: string | null;
    medium: string | null;
    dimensions: string | null;
    creation_date: string | null;
  };
  start_price_cents: number;
  increment_cents: number | null;
  current_bid_cents: number | null;
  bid_count: number;
  ends_at: string | null;
  next_min_cents: number;
  /** 'none' when the lot has no reserve. */
  reserve_status: 'none' | 'met' | 'not_met';
  /** Only for the organizer team and the consignor. */
  reserve_cents: number | null;
  viewer_status: ViewerLotStatus;
  viewer_is_seller: boolean;
  history: Array<{ label: string; amount_cents: number; created_at: string }>;
  winner_name: string | null;
};

export type AuctionView = {
  auction: AuctionRecord;
  phase: AuctionPhase;
  lastLotEndsAt: string | null;
  organizerName: string;
  exhibition: { id: string; title: string } | null;
  canManage: boolean;
  viewerId: string | null;
  lots: LotView[];
  pendingConsignments: LotView[];
  viewerConsignments: LotView[];
};

const LOT_SELECT =
  'id, auction_id, artwork_id, lot_number, consignor_account_id, status, start_price_cents, increment_cents, current_bid_cents, current_bidder_account_id, bid_count, ends_at';

type LotRow = {
  id: string;
  auction_id: string;
  artwork_id: string;
  lot_number: number;
  consignor_account_id: string;
  status: string;
  start_price_cents: number;
  increment_cents: number | null;
  current_bid_cents: number | null;
  current_bidder_account_id: string | null;
  bid_count: number;
  ends_at: string | null;
};

async function organizerName(auction: AuctionRecord): Promise<string> {
  const db = adminDb();
  if (auction.organizer_profile_id) {
    const { data } = await db.from('user_profiles').select('name').eq('id', auction.organizer_profile_id).maybeSingle();
    if (data?.name) return data.name as string;
  }
  const { data } = await db.from('accounts').select('name').eq('id', auction.organizer_account_id).maybeSingle();
  return (data?.name as string) || 'Provenance member';
}

/**
 * Everything the auction page needs. Settles any lots whose time has run out
 * first, so the page never shows a lot as live after it closed.
 */
export async function getAuctionView(auctionId: string): Promise<AuctionView | null> {
  const db = adminDb();
  try {
    await finalizeOverdueLots(db, { auctionId });
  } catch (err) {
    logger.error('auction_lazy_finalize_failed', { auctionId, error: err });
  }

  const auction = await loadAuction(auctionId);
  if (!auction) return null;
  const viewer = await getViewer();
  const canManage = await canManageAuction(viewer?.id, auction);
  const isPublic = auction.status !== 'draft' && auction.published_at;
  if (!isPublic && !canManage) return null;

  const { data: lotRows } = await db
    .from('auction_lots')
    .select(LOT_SELECT)
    .eq('auction_id', auctionId)
    .order('lot_number', { ascending: true });
  const rows = (lotRows ?? []) as LotRow[];

  const artworkIds = [...new Set(rows.map((r) => r.artwork_id))];
  const lotIds = rows.map((r) => r.id);
  const [{ data: arts }, { data: reserves }, { data: bids }] = await Promise.all([
    artworkIds.length
      ? db.from('artworks').select('id, title, artist_name, image_url, medium, dimensions, creation_date').in('id', artworkIds)
      : Promise.resolve({ data: [] }),
    lotIds.length ? db.from('auction_lot_reserves').select('lot_id, reserve_cents').in('lot_id', lotIds) : Promise.resolve({ data: [] }),
    lotIds.length
      ? db
          .from('auction_bids')
          .select('lot_id, bidder_account_id, amount_cents, created_at')
          .in('lot_id', lotIds)
          .order('created_at', { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [] }),
  ]);

  const artBy = new Map(((arts ?? []) as Array<LotView['artwork']>).map((a) => [a.id, a]));
  const reserveBy = new Map(((reserves ?? []) as Array<{ lot_id: string; reserve_cents: number }>).map((r) => [r.lot_id, r.reserve_cents]));
  const bidsBy = new Map<string, Array<{ bidder_account_id: string; amount_cents: number; created_at: string }>>();
  for (const b of (bids ?? []) as Array<{ lot_id: string; bidder_account_id: string; amount_cents: number; created_at: string }>) {
    const list = bidsBy.get(b.lot_id) ?? [];
    list.push(b);
    bidsBy.set(b.lot_id, list);
  }

  // Winner names are shown to the seller side only.
  const winnerIds = [...new Set(rows.filter((r) => r.status === 'sold' && r.current_bidder_account_id).map((r) => r.current_bidder_account_id!))];
  const winnerNames = new Map<string, string>();
  if (winnerIds.length) {
    const { data: accts } = await db.from('accounts').select('id, name, email').in('id', winnerIds);
    for (const a of (accts ?? []) as Array<{ id: string; name: string | null; email: string | null }>) {
      winnerNames.set(a.id, a.name || a.email || 'Buyer');
    }
  }

  const toView = (r: LotRow): LotView => {
    const lotBids = bidsBy.get(r.id) ?? [];
    const labels = bidderLabels(lotBids, viewer?.id);
    const reserve = reserveBy.get(r.id) ?? null;
    const isSeller = canManage || r.consignor_account_id === viewer?.id;
    const viewerHasBid = !!viewer && lotBids.some((b) => b.bidder_account_id === viewer.id);
    return {
      id: r.id,
      lot_number: r.lot_number,
      status: r.status,
      consignor_account_id: r.consignor_account_id,
      artwork: artBy.get(r.artwork_id) ?? {
        id: r.artwork_id,
        title: 'Untitled',
        artist_name: null,
        image_url: null,
        medium: null,
        dimensions: null,
        creation_date: null,
      },
      start_price_cents: r.start_price_cents,
      increment_cents: r.increment_cents,
      current_bid_cents: r.current_bid_cents,
      bid_count: r.bid_count,
      ends_at: r.ends_at,
      next_min_cents: nextMinimumBid(r),
      reserve_status: reserve == null ? 'none' : reserveMet(r.current_bid_cents, reserve) ? 'met' : 'not_met',
      reserve_cents: isSeller ? reserve : null,
      viewer_status: viewerLotStatus(r, viewer?.id, viewerHasBid),
      viewer_is_seller: isSeller,
      history: lotBids.slice(0, 10).map((b) => ({
        label: labels.get(b.bidder_account_id) ?? 'Bidder',
        amount_cents: b.amount_cents,
        created_at: b.created_at,
      })),
      winner_name:
        isSeller && r.status === 'sold' && r.current_bidder_account_id
          ? (winnerNames.get(r.current_bidder_account_id) ?? null)
          : null,
    };
  };

  const shownStatuses = canManage ? ['open', 'sold', 'passed', 'withdrawn'] : ['open', 'sold', 'passed'];
  const lots = rows.filter((r) => shownStatuses.includes(r.status)).map(toView);
  const pendingConsignments = canManage ? rows.filter((r) => r.status === 'pending').map(toView) : [];
  const viewerConsignments = viewer
    ? rows.filter((r) => r.consignor_account_id === viewer.id && ['pending', 'declined'].includes(r.status)).map(toView)
    : [];

  const openEnds = rows.filter((r) => r.status === 'open' && r.ends_at).map((r) => r.ends_at!);
  const lastLotEndsAt = openEnds.length ? openEnds.sort().at(-1)! : null;

  let exhibition: AuctionView['exhibition'] = null;
  if (auction.exhibition_id) {
    const { data } = await db.from('exhibitions').select('id, title').eq('id', auction.exhibition_id).maybeSingle();
    if (data) exhibition = { id: data.id as string, title: data.title as string };
  }

  return {
    auction,
    phase: auctionPhase(auction, new Date(), lastLotEndsAt),
    lastLotEndsAt,
    organizerName: await organizerName(auction),
    exhibition,
    canManage,
    viewerId: viewer?.id ?? null,
    lots,
    pendingConsignments,
    viewerConsignments,
  };
}

export type AuctionCard = {
  id: string;
  title: string;
  image_url: string | null;
  starts_at: string;
  ends_at: string;
  lastLotEndsAt: string | null;
  phase: AuctionPhase;
  organizerName: string;
  lotCount: number;
  accepts_consignments: boolean;
};

/** Published auctions plus the viewer's own drafts, grouped by phase. */
export async function listAuctions(): Promise<{ cards: AuctionCard[]; mine: AuctionCard[] }> {
  const db = adminDb();
  try {
    await finalizeOverdueLots(db);
  } catch (err) {
    logger.error('auction_list_finalize_failed', { error: err });
  }
  const viewer = await getViewer();

  const { data: published } = await db
    .from('auctions')
    .select(AUCTION_SELECT)
    .in('status', ['published', 'closed'])
    .not('published_at', 'is', null)
    .order('ends_at', { ascending: false })
    .limit(100);

  let mineRows: AuctionRecord[] = [];
  if (viewer) {
    const { data } = await db
      .from('auctions')
      .select(AUCTION_SELECT)
      .eq('organizer_account_id', viewer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    mineRows = (data ?? []) as AuctionRecord[];
  }

  const all = [...((published ?? []) as AuctionRecord[]), ...mineRows];
  const ids = [...new Set(all.map((a) => a.id))];
  const { data: lots } = ids.length
    ? await db.from('auction_lots').select('auction_id, status, ends_at, artwork_id').in('auction_id', ids).in('status', ['open', 'sold', 'passed'])
    : { data: [] };
  const lotsBy = new Map<string, Array<{ status: string; ends_at: string | null; artwork_id: string }>>();
  for (const l of (lots ?? []) as Array<{ auction_id: string; status: string; ends_at: string | null; artwork_id: string }>) {
    const list = lotsBy.get(l.auction_id) ?? [];
    list.push(l);
    lotsBy.set(l.auction_id, list);
  }

  const nameCache = new Map<string, string>();
  const now = new Date();
  const toCard = async (a: AuctionRecord): Promise<AuctionCard> => {
    const key = a.organizer_profile_id ?? a.organizer_account_id;
    if (!nameCache.has(key)) nameCache.set(key, await organizerName(a));
    const l = lotsBy.get(a.id) ?? [];
    const openEnds = l.filter((x) => x.status === 'open' && x.ends_at).map((x) => x.ends_at!).sort();
    const lastLotEndsAt = openEnds.at(-1) ?? null;
    return {
      id: a.id,
      title: a.title,
      image_url: a.image_url,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      lastLotEndsAt,
      phase: auctionPhase(a, now, lastLotEndsAt),
      organizerName: nameCache.get(key)!,
      lotCount: l.length,
      accepts_consignments: a.accepts_consignments,
    };
  };

  const cards = await Promise.all(((published ?? []) as AuctionRecord[]).map(toCard));
  const mine = await Promise.all(mineRows.map(toCard));
  return { cards, mine };
}

export type MyBidRow = {
  lotId: string;
  auctionId: string;
  auctionTitle: string;
  currency: string;
  lotNumber: number;
  artworkTitle: string;
  imageUrl: string | null;
  myMaxCents: number;
  currentBidCents: number | null;
  endsAt: string | null;
  status: ViewerLotStatus;
};

export async function getMyBids(userId: string): Promise<MyBidRow[]> {
  const db = adminDb();
  const { data: bids } = await db
    .from('auction_bids')
    .select('lot_id, amount_cents')
    .eq('bidder_account_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);
  const maxBy = new Map<string, number>();
  for (const b of (bids ?? []) as Array<{ lot_id: string; amount_cents: number }>) {
    maxBy.set(b.lot_id, Math.max(maxBy.get(b.lot_id) ?? 0, b.amount_cents));
  }
  const lotIds = [...maxBy.keys()];
  if (!lotIds.length) return [];

  const { data: lotRows } = await db.from('auction_lots').select(LOT_SELECT).in('id', lotIds);
  const rows = (lotRows ?? []) as LotRow[];
  const auctionIds = [...new Set(rows.map((r) => r.auction_id))];
  for (const id of auctionIds) {
    try {
      await finalizeOverdueLots(db, { auctionId: id });
    } catch {
      /* best effort */
    }
  }
  const { data: fresh } = await db.from('auction_lots').select(LOT_SELECT).in('id', lotIds);
  const lots = (fresh ?? []) as LotRow[];
  const [{ data: auctions }, { data: arts }] = await Promise.all([
    db.from('auctions').select('id, title, currency').in('id', auctionIds),
    db.from('artworks').select('id, title, image_url').in('id', lots.map((l) => l.artwork_id)),
  ]);
  const auctionBy = new Map(((auctions ?? []) as Array<{ id: string; title: string; currency: string }>).map((a) => [a.id, a]));
  const artBy = new Map(((arts ?? []) as Array<{ id: string; title: string; image_url: string | null }>).map((a) => [a.id, a]));

  return lots
    .map((l) => ({
      lotId: l.id,
      auctionId: l.auction_id,
      auctionTitle: auctionBy.get(l.auction_id)?.title ?? 'Auction',
      currency: auctionBy.get(l.auction_id)?.currency ?? 'USD',
      lotNumber: l.lot_number,
      artworkTitle: artBy.get(l.artwork_id)?.title || 'Untitled',
      imageUrl: artBy.get(l.artwork_id)?.image_url ?? null,
      myMaxCents: maxBy.get(l.id) ?? 0,
      currentBidCents: l.current_bid_cents,
      endsAt: l.ends_at,
      status: viewerLotStatus(l, userId, true),
    }))
    .sort((a, b) => (a.endsAt ?? '').localeCompare(b.endsAt ?? ''));
}
