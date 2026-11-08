import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';

import {
  buildWorkKeys,
  computeSellThrough,
  fillMissingBuyers,
  type ExhibitionSellThrough,
  type SaleRow,
  type ShownLink,
} from './group-collectors';
import { loadOwnershipHolders } from './load-ownership-holders';

const LEDGER_COLS = 'id, artwork_id, sold_to_account_id, sold_to_email, sold_to_name, price_cents, sold_at';

/**
 * Sell-through for one exhibition, for its organiser. The owner's other sales
 * are loaded too so "new collectors" means first purchase from this gallery.
 */
export async function loadExhibitionSellThrough(
  exhibitionId: string,
  galleryOwnerId: string,
): Promise<ExhibitionSellThrough | null> {
  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    const { data: linkRows } = await admin
      .from('exhibition_artworks')
      .select('exhibition_id, artwork_id, status')
      .eq('exhibition_id', exhibitionId);
    const shownLinks: ShownLink[] = ((linkRows ?? []) as Array<ShownLink & { status: string | null }>)
      .filter((l) => isShownInExhibition(l.status))
      .map(({ exhibition_id, artwork_id }) => ({ exhibition_id, artwork_id }));
    if (!shownLinks.length) return null;

    const linkedIds = Array.from(new Set(shownLinks.map((l) => l.artwork_id)));
    const [byArtwork, bySeller, artworkRes] = await Promise.all([
      admin.from('sales_ledger').select(LEDGER_COLS).in('artwork_id', linkedIds),
      admin.from('sales_ledger').select(LEDGER_COLS).eq('sold_by_account_id', galleryOwnerId),
      admin
        .from('artworks')
        .select('id, source_artwork_id, is_sold, sold_at, sold_price_cents, sold_to_account_id, sold_to_email, sold_to_name')
        .in('id', linkedIds),
    ]);

    const ledgerById = new Map<string, SaleRow>();
    for (const row of [...(byArtwork.data ?? []), ...(bySeller.data ?? [])] as SaleRow[]) {
      ledgerById.set(row.id, row);
    }
    const ledgerSales = Array.from(ledgerById.values());

    const artworks = (artworkRes.data ?? []) as Array<{
      id: string;
      source_artwork_id: string | null;
      is_sold: boolean | null;
      sold_at: string | null;
      sold_price_cents: number | null;
      sold_to_account_id: string | null;
      sold_to_email: string | null;
      sold_to_name: string | null;
    }>;
    const workKeys = buildWorkKeys(artworks);
    const worksWithLedgerSale = new Set(ledgerSales.map((s) => workKeys.get(s.artwork_id) ?? s.artwork_id));
    const artworkOnlySales: SaleRow[] = artworks
      .filter((a) => a.is_sold && a.sold_at && !worksWithLedgerSale.has(workKeys.get(a.id) ?? a.id))
      .map((a) => ({
        id: `artwork:${a.id}`,
        artwork_id: a.id,
        sold_to_account_id: a.sold_to_account_id,
        sold_to_email: a.sold_to_email,
        sold_to_name: a.sold_to_name,
        price_cents: a.sold_price_cents,
        sold_at: a.sold_at!,
      }));

    const [result] = computeSellThrough({
      exhibitionIds: [exhibitionId],
      sales: fillMissingBuyers(
        [...ledgerSales, ...artworkOnlySales],
        await loadOwnershipHolders(admin, linkedIds),
        workKeys,
      ),
      workKeys,
      shownLinks,
    });
    return result ?? null;
  } catch (err) {
    console.error('[Collectors] loadExhibitionSellThrough failed', err);
    return null;
  }
}
