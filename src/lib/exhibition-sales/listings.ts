import { preferArtistCoa } from '~/app/exhibitions/_helpers/prefer-artist-coa';
import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { endOfDateOnly } from '~/lib/parse-date-only';

/**
 * Which works in an exhibition can be bought online, at what price and who is
 * paid. Pure: callers load the rows (see load-listings.ts).
 *
 * A work can hang in a show through the artist's COA, the Certificate of Show
 * issued from it, or both; the page shows it once, as the COA. The per-show
 * price lives on the work's exhibition_artworks link, which may be the COA's
 * or the COS's, so we look at every link folded into the shown work.
 */

export type SalesExhibitionRow = {
  id: string;
  gallery_id: string;
  title: string;
  end_date: string | null;
  published_at: string | null;
  sales_enabled: boolean | null;
  commission_percent: number | string | null;
};

export type SalesLinkRow = {
  artwork_id: string;
  cos_artwork_id?: string | null;
  status?: string | null;
  for_sale?: boolean | null;
  sale_price_cents?: number | null;
  sale_currency?: string | null;
};

export type SalesArtworkRow = {
  id: string;
  title: string | null;
  artist_name?: string | null;
  image_url: string | null;
  account_id: string;
  artist_account_id: string | null;
  certificate_type: string | null;
  source_artwork_id: string | null;
  status: string | null;
  is_public?: boolean | null;
  is_sold: boolean | null;
  sold_at: string | null;
  checkout_reserved_until: string | null;
};

export type ExhibitionListing = {
  /** The id the exhibition page shows the work under. */
  artworkId: string;
  /** Every certificate behind this work in the show (held / sold together). */
  relatedArtworkIds: string[];
  /** The certificate the sale is recorded on (the one carrying the price). */
  saleArtworkId: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  forSale: boolean;
  priceCents: number | null;
  currency: string;
  artistAccountId: string;
  isSold: boolean;
  reservedUntil: string | null;
};

export function exhibitionSalesOpen(ex: SalesExhibitionRow, now: Date = new Date()): boolean {
  if (!ex.sales_enabled || !ex.published_at) return false;
  if (ex.end_date && endOfDateOnly(ex.end_date).getTime() < now.getTime()) return false;
  return true;
}

export function commissionPercentOf(ex: SalesExhibitionRow): number {
  const n = Number(ex.commission_percent ?? 0);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

export function buildExhibitionListings(
  links: SalesLinkRow[],
  artworks: SalesArtworkRow[],
): Map<string, ExhibitionListing> {
  const shownLinks = links.filter((l) => isShownInExhibition(l.status));
  const byId = new Map(artworks.map((a) => [a.id, a]));
  const visible = artworks.filter((a) => a.status === 'verified');
  const { rows, foldedInto } = preferArtistCoa(visible, shownLinks);

  // Only works hung through a shown link appear on the page.
  const shownIds = new Set(shownLinks.map((l) => l.artwork_id));
  const result = new Map<string, ExhibitionListing>();
  for (const row of rows) {
    if (!shownIds.has(row.id)) continue;
    const related = new Set<string>([row.id]);
    for (const [folded, into] of foldedInto) if (into === row.id) related.add(folded);

    // Links for this work: its own, a folded certificate's, or one naming it as the COS.
    const myLinks = shownLinks.filter(
      (l) => related.has(l.artwork_id) || (l.cos_artwork_id && related.has(l.cos_artwork_id)),
    );
    if (myLinks.length === 0) continue;
    for (const l of myLinks) {
      related.add(l.artwork_id);
      if (l.cos_artwork_id && byId.has(l.cos_artwork_id)) related.add(l.cos_artwork_id);
    }

    const priced =
      myLinks.find((l) => l.for_sale && (l.sale_price_cents ?? 0) > 0) ??
      myLinks.find((l) => (l.sale_price_cents ?? 0) > 0) ??
      myLinks[0]!;

    const relatedRows = [...related].map((id) => byId.get(id)).filter(Boolean) as SalesArtworkRow[];
    const isSold = relatedRows.some((r) => r.is_sold || r.sold_at);
    const reservedUntil =
      relatedRows
        .map((r) => r.checkout_reserved_until)
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;

    result.set(row.id, {
      artworkId: row.id,
      relatedArtworkIds: [...related],
      saleArtworkId: priced.artwork_id,
      title: row.title || 'Untitled',
      artistName: row.artist_name?.trim() || null,
      imageUrl: row.image_url,
      forSale: !!priced.for_sale && (priced.sale_price_cents ?? 0) > 0,
      priceCents: priced.sale_price_cents ?? null,
      currency: (priced.sale_currency || 'usd').toLowerCase(),
      artistAccountId: row.artist_account_id || row.account_id,
      isSold,
      reservedUntil,
    });
  }
  return result;
}

/** Can a buyer add this work to their cart / pay for it right now? */
export function isPurchasable(listing: ExhibitionListing): boolean {
  return listing.forSale && !!listing.priceCents && !listing.isSold;
}

export function isHeldByAnotherCheckout(listing: ExhibitionListing, now: Date = new Date()): boolean {
  return !!listing.reservedUntil && new Date(listing.reservedUntil).getTime() > now.getTime();
}
