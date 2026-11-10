'use server';

import { revalidatePath } from 'next/cache';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { getExhibitionWithDetails } from '~/app/exhibitions/_actions/get-exhibitions';
import { resolveExhibitionHeaderImage } from '~/app/exhibitions/_helpers/header-image';
import { logger } from '~/lib/logger';
import {
  DEFAULT_ANTI_SNIPE_SECONDS,
  DEFAULT_LOT_STAGGER_SECONDS,
  MAX_LOTS_PER_AUCTION,
  defaultStartPriceCents,
  parseMoneyToCents,
} from '~/lib/auctions/bid-rules';

import { adminDb, canAuctionArtwork, getViewer } from '../_lib/auction-access';

type Result = { success: true; auctionId: string } | { success: false; error: string };

export interface CreateAuctionInput {
  title: string;
  description?: string | null;
  organizerAccountId?: string | null;
  startsAt: string;
  endsAt: string;
  acceptsConsignments?: boolean;
  lots: Array<{ artworkId: string; startPrice?: string | number | null; reserve?: string | number | null }>;
}

function cleanDates(startsAt: string, endsAt: string): { starts: string; ends: string } | { error: string } {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { error: 'Choose a start and end time' };
  if (e <= s) return { error: 'The auction must end after it starts' };
  return { starts: s.toISOString(), ends: e.toISOString() };
}

/** A collector's (or gallery's) own auction of works they hold. Created as a draft. */
export async function createAuction(input: CreateAuctionInput): Promise<Result> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, error: 'You must be signed in' };

    const title = input.title?.trim();
    if (!title) return { success: false, error: 'Give the auction a title' };
    const dates = cleanDates(input.startsAt, input.endsAt);
    if ('error' in dates) return { success: false, error: dates.error };

    const organizer = input.organizerAccountId || viewer.id;
    if (organizer !== viewer.id && !(await canManageExhibition(viewer.id, organizer))) {
      return { success: false, error: "You can't run an auction for that account" };
    }

    const lots = (input.lots ?? []).slice(0, MAX_LOTS_PER_AUCTION);
    const db = adminDb();

    const ids = [...new Set(lots.map((l) => l.artworkId))];
    const { data: arts } = ids.length
      ? await db.from('artworks').select('id, account_id, gallery_profile_id, image_url, is_sold').in('id', ids)
      : { data: [] };
    const artById = new Map(((arts ?? []) as Array<Record<string, unknown>>).map((a) => [a.id as string, a]));

    for (const lot of lots) {
      const art = artById.get(lot.artworkId);
      if (!art) return { success: false, error: 'One of the works was not found' };
      if (art.is_sold) return { success: false, error: 'One of the works is already sold' };
      if (!(await canAuctionArtwork(viewer.id, art as { id: string; account_id: string | null; gallery_profile_id: string | null }))) {
        return { success: false, error: "You can only auction works you or your team hold" };
      }
    }

    const firstImage = lots.map((l) => artById.get(l.artworkId)?.image_url as string | null).find(Boolean) ?? null;

    const { data: auction, error } = await db
      .from('auctions')
      .insert({
        organizer_account_id: organizer,
        title,
        description: input.description?.trim() || null,
        image_url: firstImage,
        starts_at: dates.starts,
        ends_at: dates.ends,
        lot_stagger_seconds: DEFAULT_LOT_STAGGER_SECONDS,
        anti_snipe_seconds: DEFAULT_ANTI_SNIPE_SECONDS,
        accepts_consignments: Boolean(input.acceptsConsignments),
        status: 'draft',
        created_by: viewer.id,
      })
      .select('id')
      .single();
    if (error || !auction) {
      logger.error('create_auction_failed', { error });
      return { success: false, error: 'Could not create the auction' };
    }

    const lotError = await insertLots(
      db,
      auction.id as string,
      viewer.id,
      lots.map((l) => ({
        artworkId: l.artworkId,
        startCents: parseMoneyToCents(l.startPrice ?? '') ?? 0,
        reserveCents: l.reserve == null || l.reserve === '' ? null : parseMoneyToCents(l.reserve),
      })),
    );
    if (lotError) {
      await db.from('auctions').delete().eq('id', auction.id);
      return { success: false, error: lotError };
    }

    revalidatePath('/auctions');
    return { success: true, auctionId: auction.id as string };
  } catch (err) {
    logger.error('create_auction_failed', { error: err });
    return { success: false, error: 'Could not create the auction' };
  }
}

async function insertLots(
  db: ReturnType<typeof adminDb>,
  auctionId: string,
  consignorId: string,
  lots: Array<{ artworkId: string; startCents: number; reserveCents: number | null }>,
): Promise<string | null> {
  if (!lots.length) return null;
  const { data: inserted, error } = await db
    .from('auction_lots')
    .insert(
      lots.map((l, i) => ({
        auction_id: auctionId,
        artwork_id: l.artworkId,
        lot_number: i + 1,
        consignor_account_id: consignorId,
        status: 'open',
        start_price_cents: l.startCents,
      })),
    )
    .select('id, artwork_id');
  if (error) {
    logger.error('create_auction_lots_failed', { auctionId, error });
    return error.code === '23505'
      ? 'One of the works is already in another auction'
      : 'Could not add the works to the auction';
  }
  const lotByArtwork = new Map(((inserted ?? []) as Array<{ id: string; artwork_id: string }>).map((r) => [r.artwork_id, r.id]));
  const reserves = lots
    .filter((l) => l.reserveCents != null && l.reserveCents > 0)
    .map((l) => ({ lot_id: lotByArtwork.get(l.artworkId), reserve_cents: l.reserveCents }))
    .filter((r) => r.lot_id);
  if (reserves.length) await db.from('auction_lot_reserves').insert(reserves);
  return null;
}

/**
 * Turn an exhibition into an auction: a draft run by the show's organizer,
 * with one lot per work shown and not yet sold. Start prices default to half
 * the list price. Returns the existing auction if the show already has one.
 */
export async function createAuctionFromExhibition(exhibitionId: string): Promise<Result> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, error: 'You must be signed in' };

    const db = adminDb();
    const { data: exhibition } = await db
      .from('exhibitions')
      .select('id, title, description, gallery_id, owner_role, gallery_profile_id, start_date, end_date, image_url, metadata')
      .eq('id', exhibitionId)
      .maybeSingle();
    if (!exhibition) return { success: false, error: 'Exhibition not found' };
    if (!(await canManageExhibition(viewer.id, exhibition.gallery_id as string))) {
      return { success: false, error: 'Only the show’s organizer can run it as an auction' };
    }

    const { data: existing } = await db.from('auctions').select('id').eq('exhibition_id', exhibitionId).maybeSingle();
    if (existing) return { success: true, auctionId: existing.id as string };

    const details = await getExhibitionWithDetails(exhibitionId, { viewerUserId: viewer.id });
    const works = (details?.artworks ?? []).filter((a) => !a.isSold);

    // Default: bidding opens now and closes in a week (or at the show's end, if later).
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const showEnd = exhibition.end_date ? new Date(`${exhibition.end_date}T18:00:00`) : null;
    const ends = showEnd && showEnd > weekOut ? showEnd : weekOut;

    const image = resolveExhibitionHeaderImage({
      image_url: (exhibition.image_url as string | null) ?? null,
      metadata: exhibition.metadata,
      artworks: details?.artworks ?? [],
    });

    const { data: auction, error } = await db
      .from('auctions')
      .insert({
        organizer_account_id: exhibition.gallery_id,
        organizer_profile_id: exhibition.gallery_profile_id ?? null,
        owner_role: exhibition.owner_role ?? null,
        exhibition_id: exhibitionId,
        title: exhibition.title,
        description: exhibition.description ?? null,
        image_url: image ?? works.find((w) => w.image_url)?.image_url ?? null,
        starts_at: now.toISOString(),
        ends_at: ends.toISOString(),
        lot_stagger_seconds: DEFAULT_LOT_STAGGER_SECONDS,
        anti_snipe_seconds: DEFAULT_ANTI_SNIPE_SECONDS,
        status: 'draft',
        created_by: viewer.id,
      })
      .select('id')
      .single();
    if (error || !auction) {
      logger.error('create_auction_from_exhibition_failed', { exhibitionId, error });
      return { success: false, error: 'Could not create the auction' };
    }

    // Skip works that are already on offer in another auction.
    const { data: busy } = works.length
      ? await db.from('auction_lots').select('artwork_id').in('artwork_id', works.map((w) => w.id)).in('status', ['pending', 'open'])
      : { data: [] };
    const busyIds = new Set(((busy ?? []) as Array<{ artwork_id: string }>).map((b) => b.artwork_id));

    const lotError = await insertLots(
      db,
      auction.id as string,
      viewer.id,
      works
        .filter((w) => !busyIds.has(w.id))
        .map((w) => ({
          artworkId: w.id,
          startCents: defaultStartPriceCents(parseMoneyToCents(w.listPriceDisplay ?? '')),
          reserveCents: null,
        })),
    );
    if (lotError) {
      await db.from('auctions').delete().eq('id', auction.id);
      return { success: false, error: lotError };
    }

    revalidatePath(`/exhibitions/${exhibitionId}`);
    revalidatePath('/auctions');
    return { success: true, auctionId: auction.id as string };
  } catch (err) {
    logger.error('create_auction_from_exhibition_failed', { exhibitionId, error: err });
    return { success: false, error: 'Could not create the auction' };
  }
}
