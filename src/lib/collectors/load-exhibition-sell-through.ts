import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import {
  artworkOnlySales,
  expandChain,
  inChunks,
  LEDGER_SALE_COLS,
  loadExhibitionCounts,
  loadLedgerSales,
  loadSoldRows,
  priceSales,
} from '~/lib/sales/load-chain-sales';

import {
  computeSellThrough,
  fillMissingBuyers,
  type ExhibitionSellThrough,
  type SaleRow,
  type ShownLink,
} from './group-collectors';
import { loadOwnershipHolders } from './load-ownership-holders';

/**
 * Sell-through for one exhibition, for its organiser. A sale counts wherever
 * it was recorded: the show's CoS, the artist's CoA, or the buyer's CoO.
 * Unpriced sales count at the work's set value (flagged estimated). The
 * owner's other sales are loaded too so "new collectors" means first purchase
 * from this gallery. Returns null when nothing was shown; throws on failure.
 */
export async function loadExhibitionSellThrough(
  exhibitionId: string,
  galleryOwnerId: string,
): Promise<ExhibitionSellThrough | null> {
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: linkRows, error: linkErr } = await admin
    .from('exhibition_artworks')
    .select('exhibition_id, artwork_id, status')
    .eq('exhibition_id', exhibitionId);
  if (linkErr) throw linkErr;
  const shownLinks: ShownLink[] = ((linkRows ?? []) as Array<ShownLink & { status: string | null }>)
    .filter((l) => isShownInExhibition(l.status))
    .map(({ exhibition_id, artwork_id }) => ({ exhibition_id, artwork_id }));
  if (!shownLinks.length) return null;

  const { data: ownerSales } = await admin
    .from('sales_ledger')
    .select(LEDGER_SALE_COLS)
    .eq('sold_by_account_id', galleryOwnerId);

  const chain = await expandChain(admin, [
    ...shownLinks.map((l) => l.artwork_id),
    ...((ownerSales ?? []) as SaleRow[]).map((s) => s.artwork_id),
  ]);

  const ledgerById = new Map<string, SaleRow>();
  for (const row of [...(await loadLedgerSales(admin, chain.ids)), ...((ownerSales ?? []) as SaleRow[])]) {
    ledgerById.set(row.id, row);
  }
  const ledger = Array.from(ledgerById.values());

  const soldRows = await loadSoldRows(admin, chain.ids);

  const sales = priceSales({
    sales: fillMissingBuyers(
      [...ledger, ...artworkOnlySales(soldRows, ledger, chain.workKeys)],
      await inChunks(chain.ids, (ids) => loadOwnershipHolders(admin, ids)),
      chain.workKeys,
    ),
    chain: chain.rows,
    workKeys: chain.workKeys,
    exhibitionCountByWork: await loadExhibitionCounts(admin, chain.ids, chain.workKeys),
  });

  const [result] = computeSellThrough({
    exhibitionIds: [exhibitionId],
    sales,
    workKeys: chain.workKeys,
    shownLinks,
  });
  return result ?? null;
}
