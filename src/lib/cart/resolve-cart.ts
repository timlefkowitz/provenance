import 'server-only';

import {
  commissionPercentOf,
  exhibitionSalesOpen,
  isHeldByAnotherCheckout,
  isPurchasable,
} from '~/lib/exhibition-sales/listings';
import { loadDirectListing } from '~/lib/exhibition-sales/certificate-offer';
import { loadExhibitionListings } from '~/lib/exhibition-sales/load-listings';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import type { CartLine } from './cart-types';

export type UnavailableReason = 'not_found' | 'sales_closed' | 'not_for_sale' | 'sold' | 'held';

export type ResolvedCartItem = {
  artworkId: string;
  exhibitionId: string | null;
  available: boolean;
  reason: UnavailableReason | null;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  exhibitionTitle: string;
  priceCents: number;
  currency: string;
  artistAccountId: string;
  galleryAccountId: string | null;
  commissionPercent: number;
  relatedArtworkIds: string[];
  /** A collector's resale: the buyer must be signed in to receive the CoO. */
  requiresAccount: boolean;
};

/**
 * Look up each cart line against its exhibition's live listings: price, who
 * gets paid, and whether it can still be bought. Prices always come from the
 * database, never from the browser.
 */
export async function resolveCartItems(
  admin: UntypedSupabaseClient,
  lines: CartLine[],
): Promise<ResolvedCartItem[]> {
  const exhibitionIds = [...new Set(lines.map((l) => l.exhibitionId).filter((id): id is string => !!id))];
  const loaded = new Map(
    await Promise.all(
      exhibitionIds.map(async (id) => [id, await loadExhibitionListings(admin, id)] as const),
    ),
  );
  const now = new Date();
  const seen = new Set<string>();
  const out: ResolvedCartItem[] = [];

  for (const line of lines) {
    if (seen.has(line.artworkId)) continue;
    seen.add(line.artworkId);
    if (!line.exhibitionId) {
      out.push(await resolveDirect(admin, line.artworkId, now));
      continue;
    }
    const data = loaded.get(line.exhibitionId);
    const listing = data?.listings.get(line.artworkId);
    if (!data || !listing) {
      out.push({
        artworkId: line.artworkId,
        exhibitionId: line.exhibitionId,
        available: false,
        reason: 'not_found',
        title: 'Unavailable work',
        artistName: null,
        imageUrl: null,
        exhibitionTitle: data?.exhibition.title ?? '',
        priceCents: 0,
        currency: 'usd',
        artistAccountId: '',
        galleryAccountId: data?.exhibition.gallery_id ?? '',
        commissionPercent: 0,
        relatedArtworkIds: [],
        requiresAccount: false,
      });
      continue;
    }
    let reason: UnavailableReason | null = null;
    // Sold and held first: an invoice can override the others, never these.
    if (listing.isSold) reason = 'sold';
    else if (isHeldByAnotherCheckout(listing, now)) reason = 'held';
    else if (!exhibitionSalesOpen(data.exhibition, now)) reason = 'sales_closed';
    else if (!isPurchasable(listing)) reason = 'not_for_sale';

    out.push({
      artworkId: line.artworkId,
      exhibitionId: line.exhibitionId,
      available: reason === null,
      reason,
      title: listing.title,
      artistName: listing.artistName,
      imageUrl: listing.imageUrl,
      exhibitionTitle: data.exhibition.title,
      priceCents: listing.priceCents ?? 0,
      currency: listing.currency,
      artistAccountId: listing.artistAccountId,
      galleryAccountId: data.exhibition.gallery_id,
      commissionPercent: commissionPercentOf(data.exhibition),
      relatedArtworkIds: listing.relatedArtworkIds,
      requiresAccount: false,
    });
  }
  return out;
}

/** A work its holder sells directly: they are paid in full, no commission. */
async function resolveDirect(
  admin: UntypedSupabaseClient,
  artworkId: string,
  now: Date,
): Promise<ResolvedCartItem> {
  const d = await loadDirectListing(admin, artworkId);
  if (!d) {
    return {
      artworkId,
      exhibitionId: null,
      available: false,
      reason: 'not_for_sale',
      title: 'Unavailable work',
      artistName: null,
      imageUrl: null,
      exhibitionTitle: '',
      priceCents: 0,
      currency: 'usd',
      artistAccountId: '',
      galleryAccountId: null,
      commissionPercent: 0,
      relatedArtworkIds: [],
      requiresAccount: false,
    };
  }
  const held = !!d.reservedUntil && new Date(d.reservedUntil).getTime() > now.getTime();
  return {
    artworkId,
    exhibitionId: null,
    available: !held,
    reason: held ? 'held' : null,
    title: d.title,
    artistName: d.artistName,
    imageUrl: d.imageUrl,
    exhibitionTitle: '',
    priceCents: d.priceCents,
    currency: d.currency,
    artistAccountId: d.sellerAccountId,
    galleryAccountId: null,
    commissionPercent: 0,
    relatedArtworkIds: [artworkId],
    requiresAccount: d.isResale,
  };
}
