import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import type { SaleRow, ShownLink } from '~/lib/collectors/group-collectors';
import {
  artworkOnlySales,
  expandChain,
  inChunks,
  LEDGER_SALE_COLS,
  loadExhibitionCounts,
  loadLedgerSales,
  loadSoldRows,
  priceSales,
  type ChainArtwork,
} from '~/lib/sales/load-chain-sales';

export type CreditedSale = SaleRow & { sold_by_account_id?: string | null };

export interface AccountSales {
  /** Priced, deduped sales credited to the account. */
  sales: CreditedSale[];
  chain: ChainArtwork[];
  workKeys: Map<string, string>;
  /** Shown links for exhibitions the account organised. */
  shownLinks: ShownLink[];
  exhibitions: Array<{ id: string; title: string; start_date: string | null; end_date: string | null }>;
  /** Artist name per work key (from any certificate of the work). */
  artistByWork: Map<string, string>;
}

/**
 * Whether a sale counts for an account: it sold the work, it holds the
 * artist's or show's certificate of it, it made it, or it organised a show
 * that hung it. Buying a work never counts as a sale. Pure.
 */
export function isCreditedSale(
  sale: Pick<CreditedSale, 'artwork_id' | 'sold_to_account_id' | 'sold_by_account_id'>,
  ctx: { accountId: string; creditedWorkKeys: Set<string>; workKeys: Map<string, string> },
): boolean {
  if (sale.sold_to_account_id === ctx.accountId) return false;
  if (sale.sold_by_account_id === ctx.accountId) return true;
  return ctx.creditedWorkKeys.has(ctx.workKeys.get(sale.artwork_id) ?? sale.artwork_id);
}

async function idsWhere(admin: UntypedSupabaseClient, column: string, accountId: string): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('artworks')
      .select('id, certificate_type')
      .eq(column, accountId)
      .range(from, from + 999);
    if (error) {
      console.error('[Sales] idsWhere failed', { column, error });
      break;
    }
    const rows = (data ?? []) as Array<{ id: string; certificate_type: string | null }>;
    // A Certificate of Ownership makes you the buyer, not the seller.
    out.push(...rows.filter((r) => r.certificate_type !== 'ownership').map((r) => r.id));
    if (rows.length < 1000) break;
  }
  return out;
}

/** Every sale credited to `accountId`, priced (recorded, else set value) and deduped. */
export async function loadAccountSales(admin: UntypedSupabaseClient, accountId: string): Promise<AccountSales> {
  const [heldIds, madeIds, sellerRes, exRes] = await Promise.all([
    idsWhere(admin, 'account_id', accountId),
    idsWhere(admin, 'artist_account_id', accountId),
    admin.from('sales_ledger').select(LEDGER_SALE_COLS).eq('sold_by_account_id', accountId),
    admin
      .from('exhibitions')
      .select('id, title, start_date, end_date')
      .eq('gallery_id', accountId)
      .order('start_date', { ascending: false, nullsFirst: false }),
  ]);
  const exhibitions = (exRes.data ?? []) as AccountSales['exhibitions'];

  const links = await inChunks(
    exhibitions.map((e) => e.id),
    async (ids) => {
      const { data } = await admin
        .from('exhibition_artworks')
        .select('exhibition_id, artwork_id, status')
        .in('exhibition_id', ids);
      return (data ?? []) as Array<ShownLink & { status: string | null }>;
    },
  );
  const shownLinks = links
    .filter((l) => isShownInExhibition(l.status))
    .map(({ exhibition_id, artwork_id }) => ({ exhibition_id, artwork_id }));

  const sellerSales = (sellerRes.data ?? []) as CreditedSale[];
  const creditedIds = [...heldIds, ...madeIds, ...shownLinks.map((l) => l.artwork_id)];
  const chain = await expandChain(admin, [...creditedIds, ...sellerSales.map((s) => s.artwork_id)]);
  const { workKeys } = chain;
  const creditedWorkKeys = new Set(creditedIds.map((id) => workKeys.get(id) ?? id));

  const [chainLedger, allSoldRows, exhibitionCountByWork, named] = await Promise.all([
    loadLedgerSales(admin, chain.ids),
    loadSoldRows(admin, chain.ids),
    loadExhibitionCounts(admin, chain.ids, workKeys),
    inChunks(chain.ids, async (ids) => {
      const { data } = await admin.from('artworks').select('id, artist_name').in('id', ids).not('artist_name', 'is', null);
      return (data ?? []) as Array<{ id: string; artist_name: string | null }>;
    }),
  ]);
  const byId = new Map<string, CreditedSale>();
  for (const row of [...chainLedger, ...sellerSales]) byId.set(row.id, row);
  const ledger = Array.from(byId.values());
  const soldRows = allSoldRows.filter((r) => creditedWorkKeys.has(workKeys.get(r.id) ?? r.id));

  const ctx = { accountId, creditedWorkKeys, workKeys };
  const sales = priceSales({
    sales: [...ledger, ...artworkOnlySales(soldRows, ledger, workKeys)].filter((s) => isCreditedSale(s, ctx)),
    chain: chain.rows,
    workKeys,
    exhibitionCountByWork,
  }) as CreditedSale[];

  const artistByWork = new Map<string, string>();
  for (const r of named) {
    const key = workKeys.get(r.id) ?? r.id;
    if (r.artist_name?.trim() && !artistByWork.has(key)) artistByWork.set(key, r.artist_name.trim());
  }

  return { sales, chain: chain.rows, workKeys, shownLinks, exhibitions, artistByWork };
}
