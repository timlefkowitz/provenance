import 'server-only';

import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';

import {
  buildExhibitionListings,
  type ExhibitionListing,
  type SalesArtworkRow,
  type SalesExhibitionRow,
  type SalesLinkRow,
} from './listings';

const ARTWORK_COLUMNS =
  'id, title, artist_name, image_url, account_id, artist_account_id, certificate_type, source_artwork_id, status, is_public, is_sold, sold_at, checkout_reserved_until';

/** Load an exhibition's sale settings and its listings. Pass an admin client. */
export async function loadExhibitionListings(
  admin: UntypedSupabaseClient,
  exhibitionId: string,
): Promise<{ exhibition: SalesExhibitionRow; listings: Map<string, ExhibitionListing> } | null> {
  const db = asUntyped(admin);
  const { data: exhibition } = await db
    .from('exhibitions')
    .select('id, gallery_id, title, end_date, published_at, sales_enabled, commission_percent')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return null;

  const { data: links, error: linksErr } = await db
    .from('exhibition_artworks')
    .select('artwork_id, cos_artwork_id, status, for_sale, sale_price_cents, sale_currency')
    .eq('exhibition_id', exhibitionId);
  if (linksErr) {
    console.error('[ExhibitionSales] failed to load links', { exhibitionId, linksErr });
    return { exhibition: exhibition as SalesExhibitionRow, listings: new Map() };
  }

  const linkRows = (links ?? []) as SalesLinkRow[];
  const ids = new Set<string>();
  for (const l of linkRows) {
    ids.add(l.artwork_id);
    if (l.cos_artwork_id) ids.add(l.cos_artwork_id);
  }
  let artworkRows: SalesArtworkRow[] = [];
  if (ids.size > 0) {
    const { data: rows } = await db.from('artworks').select(ARTWORK_COLUMNS).in('id', [...ids]);
    artworkRows = (rows ?? []) as SalesArtworkRow[];
  }

  return {
    exhibition: exhibition as SalesExhibitionRow,
    listings: buildExhibitionListings(linkRows, artworkRows),
  };
}
