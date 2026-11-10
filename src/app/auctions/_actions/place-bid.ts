'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { logger } from '~/lib/logger';
import { createNotification } from '~/lib/notifications';
import { finalizeOverdueLots } from '~/lib/auctions/finalize-lots';
import { bidErrorMessage, formatCents } from '~/lib/auctions/bid-rules';
import { asUntyped } from '~/lib/supabase-untyped';

import { adminDb } from '../_lib/auction-access';

export type PlaceBidResult =
  | {
      success: true;
      currentBidCents: number;
      nextMinCents: number;
      endsAt: string;
      extended: boolean;
    }
  | { success: false; error: string; nextMinCents?: number };

type RpcResult = {
  ok: boolean;
  error?: string;
  next_min_cents?: number;
  current_bid_cents?: number;
  ends_at?: string;
  extended?: boolean;
  previous_bidder_account_id?: string | null;
};

export async function placeBid(lotId: string, amountCents: number): Promise<PlaceBidResult> {
  try {
    if (!Number.isInteger(amountCents) || amountCents <= 0) return { success: false, error: 'Enter a bid amount' };

    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: 'Sign in to bid' };

    const db = adminDb();
    const { data: lot } = await db
      .from('auction_lots')
      .select('id, auction_id, artwork_id, lot_number')
      .eq('id', lotId)
      .maybeSingle();
    if (!lot) return { success: false, error: 'This lot no longer exists' };
    const { data: auction } = await db.from('auctions').select('id, title, currency, exhibition_id').eq('id', lot.auction_id).single();

    // The RPC runs as the bidder (auth.uid()) and locks the lot row.
    const { data, error } = await client.rpc('place_auction_bid', { p_lot_id: lotId, p_amount_cents: amountCents });
    if (error) {
      logger.error('place_auction_bid_rpc_failed', { lotId, error });
      return { success: false, error: 'Could not place your bid' };
    }
    const r = data as RpcResult;
    if (!r?.ok) {
      if (r?.error === 'lot_closed') await finalizeOverdueLots(db, { auctionId: lot.auction_id as string });
      return {
        success: false,
        error: bidErrorMessage(r?.error, r?.next_min_cents, auction?.currency),
        nextMinCents: r?.next_min_cents,
      };
    }

    if (r.previous_bidder_account_id && r.previous_bidder_account_id !== user.id) {
      const { data: art } = await db.from('artworks').select('title').eq('id', lot.artwork_id).maybeSingle();
      try {
        await createNotification({
          userId: r.previous_bidder_account_id,
          type: 'auction_outbid',
          title: `You've been outbid on lot ${lot.lot_number}`,
          message: `"${art?.title || 'Untitled'}" in ${auction?.title ?? 'the auction'} is now at ${formatCents(r.current_bid_cents, auction?.currency)}. Bid ${formatCents(r.next_min_cents, auction?.currency)} or more to lead again.`,
          artworkId: lot.artwork_id as string,
          metadata: { auction_id: lot.auction_id, lot_id: lotId },
        });
      } catch (err) {
        logger.error('auction_outbid_notify_failed', { lotId, error: err });
      }
    }

    revalidatePath(`/auctions/${lot.auction_id}`);
    return {
      success: true,
      currentBidCents: r.current_bid_cents!,
      nextMinCents: r.next_min_cents!,
      endsAt: r.ends_at!,
      extended: Boolean(r.extended),
    };
  } catch (err) {
    logger.error('place_bid_failed', { lotId, error: err });
    return { success: false, error: 'Could not place your bid' };
  }
}
