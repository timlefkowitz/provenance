'use server';

import { revalidatePath } from 'next/cache';

import { logger } from '~/lib/logger';
import { createNotification } from '~/lib/notifications';
import { parseMoneyToCents } from '~/lib/auctions/bid-rules';

import { adminDb, canAuctionArtwork, getViewer, loadAuction, loadAuctionableArtworks } from '../_lib/auction-access';

type Result = { success: true; submitted: number } | { success: false; error: string };

/**
 * Consign works you hold into a gallery-run auction. Each becomes a pending
 * lot until the organizer approves it.
 */
export async function consignArtworks(
  auctionId: string,
  items: Array<{ artworkId: string; startPrice?: string | number | null; reserve?: string | number | null }>,
): Promise<Result> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, error: 'You must be signed in' };
    const auction = await loadAuction(auctionId);
    if (!auction || auction.status !== 'published') return { success: false, error: 'This auction is not open' };
    if (!auction.accepts_consignments) return { success: false, error: 'This auction is not taking consignments' };
    if (new Date(auction.ends_at) <= new Date()) return { success: false, error: 'This auction has ended' };
    if (!items.length) return { success: false, error: 'Choose at least one work' };

    const db = adminDb();
    const ids = [...new Set(items.map((i) => i.artworkId))];
    const { data: arts } = await db.from('artworks').select('id, title, account_id, gallery_profile_id, is_sold').in('id', ids);
    const list = (arts ?? []) as Array<{ id: string; title: string; account_id: string | null; gallery_profile_id: string | null; is_sold: boolean | null }>;
    if (list.length !== ids.length) return { success: false, error: 'One of the works was not found' };
    for (const art of list) {
      if (art.is_sold) return { success: false, error: `"${art.title}" is already sold` };
      if (!(await canAuctionArtwork(viewer.id, art))) return { success: false, error: 'You can only consign works you hold' };
    }

    const { data: inserted, error } = await db
      .from('auction_lots')
      .insert(
        items.map((i) => ({
          auction_id: auctionId,
          artwork_id: i.artworkId,
          lot_number: 0,
          consignor_account_id: viewer.id,
          status: 'pending',
          start_price_cents: parseMoneyToCents(i.startPrice ?? '0') ?? 0,
        })),
      )
      .select('id, artwork_id');
    if (error) {
      return {
        success: false,
        error: error.code === '23505' ? 'One of the works is already in an auction' : 'Could not consign the works',
      };
    }
    const lotBy = new Map(((inserted ?? []) as Array<{ id: string; artwork_id: string }>).map((r) => [r.artwork_id, r.id]));
    const reserves = items
      .map((i) => ({ lot_id: lotBy.get(i.artworkId), reserve_cents: i.reserve ? parseMoneyToCents(i.reserve) : null }))
      .filter((r) => r.lot_id && r.reserve_cents);
    if (reserves.length) await db.from('auction_lot_reserves').insert(reserves);

    try {
      await createNotification({
        userId: auction.organizer_account_id,
        type: 'auction_consignment_submitted',
        title: `${items.length === 1 ? 'A work was' : `${items.length} works were`} consigned to ${auction.title}`,
        message: list.map((a) => `"${a.title}"`).join(', '),
        relatedUserId: viewer.id,
        metadata: { auction_id: auctionId },
      });
    } catch (err) {
      logger.error('auction_consignment_notify_failed', { auctionId, error: err });
    }

    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath(`/auctions/${auctionId}/manage`);
    return { success: true, submitted: items.length };
  } catch (err) {
    logger.error('consign_artworks_failed', { auctionId, error: err });
    return { success: false, error: 'Could not consign the works' };
  }
}

/** Works the signed-in user could consign, for the consign dialog. */
export async function getConsignableArtworks() {
  const viewer = await getViewer();
  if (!viewer) return [];
  return loadAuctionableArtworks(viewer.id);
}

/** Published auctions that are open and taking consignments, for the Collection page picker. */
export async function getAuctionsAcceptingConsignments() {
  const viewer = await getViewer();
  const { data } = await adminDb()
    .from('auctions')
    .select('id, title, ends_at, organizer_account_id')
    .eq('status', 'published')
    .eq('accepts_consignments', true)
    .gt('ends_at', new Date().toISOString())
    .order('ends_at', { ascending: true })
    .limit(50);
  return ((data ?? []) as Array<{ id: string; title: string; ends_at: string; organizer_account_id: string }>).filter(
    (a) => a.organizer_account_id !== viewer?.id,
  );
}
