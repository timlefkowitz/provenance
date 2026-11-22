import 'server-only';

import { isSellingEnabled } from '~/lib/stripe-connect';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

import { exhibitionSalesOpen, isHeldByAnotherCheckout, isPurchasable } from './listings';
import { loadExhibitionListings } from './load-listings';

export type CertificateOffer = {
  /** The cart line: the id the work is listed under, and its show (null = sold directly). */
  artworkId: string;
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  priceCents: number;
  currency: string;
  held: boolean;
  /** A collector's resale: buying needs a signed-in account. */
  requiresAccount: boolean;
};

/**
 * Can this work be bought online right now, and how? A show with online sales
 * open that lists any certificate of the work wins (the gallery's commission
 * applies); otherwise the holder's own shop listing on this certificate.
 */
export async function findCertificateOffer(
  admin: UntypedSupabaseClient,
  artworkId: string,
  chainIds: string[],
): Promise<CertificateOffer | null> {
  const db = asUntyped(admin);
  const ids = [...new Set([artworkId, ...chainIds])];
  const now = new Date();

  try {
    const { data: links } = await db
      .from('exhibition_artworks')
      .select('exhibition_id')
      .or(`artwork_id.in.(${ids.join(',')}),cos_artwork_id.in.(${ids.join(',')})`)
      .eq('for_sale', true);
    const exhibitionIds = [...new Set((links ?? []).map((l) => l.exhibition_id as string))];
    for (const exhibitionId of exhibitionIds) {
      const loaded = await loadExhibitionListings(db, exhibitionId);
      if (!loaded || !exhibitionSalesOpen(loaded.exhibition, now)) continue;
      for (const listing of loaded.listings.values()) {
        if (!listing.relatedArtworkIds.some((id) => ids.includes(id))) continue;
        if (!isPurchasable(listing) || !listing.priceCents) continue;
        return {
          artworkId: listing.artworkId,
          exhibitionId,
          exhibitionTitle: loaded.exhibition.title,
          priceCents: listing.priceCents,
          currency: listing.currency,
          held: isHeldByAnotherCheckout(listing, now),
          requiresAccount: false,
        };
      }
    }
  } catch (err) {
    console.error('[CertificateOffer] exhibition lookup failed', { artworkId, err });
  }

  const direct = await loadDirectListing(db, artworkId);
  if (!direct) return null;
  return {
    artworkId,
    exhibitionId: null,
    exhibitionTitle: null,
    priceCents: direct.priceCents,
    currency: direct.currency,
    held: !!direct.reservedUntil && new Date(direct.reservedUntil).getTime() > now.getTime(),
    requiresAccount: direct.isResale,
  };
}

export type DirectListing = {
  artworkId: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  sellerAccountId: string;
  priceCents: number;
  currency: string;
  isSold: boolean;
  reservedUntil: string | null;
  /** Sold from a collector's Certificate of Ownership: the buyer must be signed in. */
  isResale: boolean;
};

/** A work its holder listed for sale on its own certificate (their shop). */
export async function loadDirectListing(
  admin: UntypedSupabaseClient,
  artworkId: string,
): Promise<DirectListing | null> {
  const { data: a } = await asUntyped(admin)
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, account_id, for_sale, sale_price, sale_currency, is_sold, sold_at, checkout_reserved_until, status, is_public, certificate_type',
    )
    .eq('id', artworkId)
    .maybeSingle();
  if (!a || a.status !== 'verified' || !a.is_public || !a.for_sale) return null;
  const priceCents = Math.round(Number(a.sale_price ?? 0) * 100);
  if (!(priceCents > 0) || a.is_sold || a.sold_at) return null;
  // The seller must have opened a shop, as for the artist-site buy button.
  if (!(await isSellingEnabled(a.account_id as string))) return null;
  return {
    artworkId: a.id as string,
    title: (a.title as string) || 'Untitled',
    artistName: (a.artist_name as string | null)?.trim() || null,
    imageUrl: (a.image_url as string | null) ?? null,
    sellerAccountId: a.account_id as string,
    priceCents,
    currency: ((a.sale_currency as string | null) || 'usd').toLowerCase(),
    isSold: false,
    reservedUntil: (a.checkout_reserved_until as string | null) ?? null,
    isResale: a.certificate_type === CERTIFICATE_TYPES.OWNERSHIP,
  };
}
