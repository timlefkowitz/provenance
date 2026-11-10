import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';

import { loadAncestorIds } from '~/lib/collectors/certificate-chain';
import { buildWorkKeys, type SaleRow } from '~/lib/collectors/group-collectors';
import {
  countDistinctSales,
  dedupeSameDaySales,
  listPriceOf,
  provenanceValueCents,
  resolveSaleMoney,
  setValueCents,
} from '~/lib/sales/sale-money';

/**
 * Sales statistics see one physical work, not one certificate. A work's CoA,
 * the show's CoS and the buyer's CoO are separate rows linked by
 * source_artwork_id, and a sale may be recorded on any of them. These helpers
 * expand ids to the whole chain and price every sale.
 */

export interface ChainArtwork {
  id: string;
  source_artwork_id: string | null;
  account_id: string | null;
  value: string | null;
  metadata: unknown;
  sold_price_cents: number | null;
  publications: unknown;
  /** 'ownership' for a buyer's CoO, whose value is the owner's own figure. */
  certificate_type?: string | null;
  is_sold?: boolean | null;
  sold_at?: string | null;
}

const CHAIN_COLS =
  'id, source_artwork_id, account_id, value, metadata, sold_price_cents, publications, certificate_type, is_sold, sold_at';
const MAX_DEPTH = 5;
const CHUNK = 200;

async function selectIn<T>(
  admin: UntypedSupabaseClient,
  table: string,
  cols: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await admin.from(table).select(cols).in(column, chunk);
      if (error) {
        console.error('[Sales] chain fetch failed', { table, error });
        return [] as T[];
      }
      return (data ?? []) as T[];
    }),
  );
  return results.flat();
}

/** Every certificate linked to `ids` (ancestors and descendants), with work keys. */
export async function expandChain(
  admin: UntypedSupabaseClient,
  ids: string[],
): Promise<{ ids: string[]; rows: ChainArtwork[]; workKeys: Map<string, string> }> {
  const start = Array.from(new Set(ids.filter(Boolean)));
  if (!start.length) return { ids: [], rows: [], workKeys: new Map() };

  const withAncestors = Array.from(
    new Set((await inChunks(start, async (chunk) => [...(await loadAncestorIds(admin, chunk)).keys()])).flat()),
  );
  const rows = new Map<string, ChainArtwork>();
  for (const r of await selectIn<ChainArtwork>(admin, 'artworks', CHAIN_COLS, 'id', withAncestors)) rows.set(r.id, r);

  let frontier = withAncestors;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next: string[] = [];
    for (const r of await selectIn<ChainArtwork>(admin, 'artworks', CHAIN_COLS, 'source_artwork_id', frontier)) {
      if (rows.has(r.id)) continue;
      rows.set(r.id, r);
      next.push(r.id);
    }
    frontier = next;
  }

  const list = Array.from(rows.values());
  return { ids: list.map((r) => r.id), rows: list, workKeys: buildWorkKeys(list) };
}

/**
 * Prices each sale (recorded price, a price on a linked certificate, else the
 * work's set value) and adds the work's Provenance Value. Same-day duplicates
 * of one work collapse to one sale. Pure — exported for tests.
 */
export function priceSales(params: {
  sales: SaleRow[];
  chain: ChainArtwork[];
  workKeys: Map<string, string>;
  /** Distinct exhibitions per work key. */
  exhibitionCountByWork?: Map<string, number>;
}): SaleRow[] {
  const { chain, workKeys } = params;
  const keyOf = (id: string) => workKeys.get(id) ?? id;
  const sales = dedupeSameDaySales(params.sales, workKeys);

  type WorkInfo = { rows: ChainArtwork[] };
  const works = new Map<string, WorkInfo>();
  for (const row of chain) {
    const key = keyOf(row.id);
    if (!works.has(key)) works.set(key, { rows: [] });
    works.get(key)!.rows.push(row);
  }
  const salesByWork = new Map<string, SaleRow[]>();
  for (const s of sales) {
    const key = keyOf(s.artwork_id);
    salesByWork.set(key, [...(salesByWork.get(key) ?? []), s]);
  }

  return sales.map((sale) => {
    const key = keyOf(sale.artwork_id);
    const rows = works.get(key)?.rows ?? [];
    // The certificate the sale was recorded on first, then the root, then the rest.
    const ordered = [
      ...rows.filter((r) => r.id === sale.artwork_id),
      ...rows.filter((r) => r.id === key && r.id !== sale.artwork_id),
      ...rows.filter((r) => r.id !== key && r.id !== sale.artwork_id),
    ];
    // A buyer's CoO value is what the owner typed in after the sale, not the
    // seller's price, so it never stands in for the sale amount.
    const priceSources = ordered.filter((r) => r.certificate_type !== 'ownership');
    const setValue = priceSources.map((r) => setValueCents(r)).find((v) => v !== null) ?? null;
    const valueText = priceSources.map((r) => listPriceOf(r)).find(Boolean) ?? null;
    const chainSold = Math.max(0, ...rows.map((r) => r.sold_price_cents ?? 0)) || null;
    const publicationCount = Math.max(0, ...rows.map((r) => (Array.isArray(r.publications) ? r.publications.length : 0)));
    const money = resolveSaleMoney({ priceCents: sale.price_cents, chainSoldPriceCents: chainSold, setValueCents: setValue });

    return {
      ...sale,
      money,
      provenance_value_cents: provenanceValueCents({
        value: valueText,
        exhibitionCount: params.exhibitionCountByWork?.get(key) ?? 0,
        publicationCount,
        saleCount: countDistinctSales(salesByWork.get(key) ?? [], []),
        salePriceCents: money.basis === 'value' ? null : money.cents,
      }),
    };
  });
}

/**
 * Distinct exhibitions each work (by key) was shown in: selected
 * exhibition_artworks rows on any certificate of the work, plus the show a
 * Certificate of Show was issued for. A work with a CoS counts as exhibited
 * even when no exhibition row links it (a CoS accepted from an invite).
 */
export async function loadExhibitionCounts(
  admin: UntypedSupabaseClient,
  chainIds: string[],
  workKeys: Map<string, string>,
  rows: ChainArtwork[] = [],
): Promise<Map<string, number>> {
  const links = await selectIn<{ exhibition_id: string; artwork_id: string; status: string | null }>(
    admin,
    'exhibition_artworks',
    'exhibition_id, artwork_id, status',
    'artwork_id',
    chainIds,
  );
  return countExhibitionsByWork(links, rows, workKeys);
}

/** Pure part of loadExhibitionCounts — exported for tests. */
export function countExhibitionsByWork(
  links: Array<{ exhibition_id: string; artwork_id: string; status?: string | null }>,
  rows: ChainArtwork[],
  workKeys: Map<string, string>,
): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  const add = (key: string, exhibitionId: string) => {
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(exhibitionId);
  };
  for (const l of links) {
    if (!isShownInExhibition(l.status)) continue;
    add(workKeys.get(l.artwork_id) ?? l.artwork_id, l.exhibition_id);
  }
  for (const r of rows) {
    if (r.certificate_type !== 'show') continue;
    const key = workKeys.get(r.id) ?? r.id;
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const exhibitionId = typeof meta.exhibition_id === 'string' && meta.exhibition_id ? meta.exhibition_id : null;
    if (exhibitionId) add(key, exhibitionId);
    else if (!sets.get(key)?.size) add(key, `cos:${r.id}`);
  }
  return new Map(Array.from(sets, ([k, v]) => [k, v.size]));
}

export const LEDGER_SALE_COLS =
  'id, artwork_id, sold_by_account_id, sold_to_account_id, sold_to_email, sold_to_name, price_cents, sold_at';

/** Ledger sales on any certificate in `chainIds`. */
export async function loadLedgerSales(
  admin: UntypedSupabaseClient,
  chainIds: string[],
): Promise<Array<SaleRow & { sold_by_account_id: string | null }>> {
  return selectIn(admin, 'sales_ledger', LEDGER_SALE_COLS, 'artwork_id', chainIds);
}

const SOLD_COLS = 'id, is_sold, sold_at, sold_price_cents, sold_to_account_id, sold_to_email, sold_to_name';

export type SoldArtworkRow = {
  id: string;
  is_sold: boolean | null;
  sold_at: string | null;
  sold_price_cents: number | null;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
};

/** Certificates in `chainIds` marked sold on the row itself. */
export async function loadSoldRows(admin: UntypedSupabaseClient, chainIds: string[]): Promise<SoldArtworkRow[]> {
  const rows = await selectIn<SoldArtworkRow>(admin, 'artworks', SOLD_COLS, 'id', chainIds);
  return rows.filter((r) => r.is_sold || r.sold_at);
}

/** Runs `load` over `ids` in chunks small enough for a URL, and concatenates. */
export async function inChunks<T>(ids: string[], load: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  return (await Promise.all(chunks.map(load))).flat();
}

/**
 * Sales only stored on a certificate row (older "mark sold", the toggle) for
 * works with no ledger row on any certificate. Pure.
 */
export function artworkOnlySales(
  rows: SoldArtworkRow[],
  ledger: SaleRow[],
  workKeys: Map<string, string>,
): SaleRow[] {
  const withLedger = new Set(ledger.map((s) => workKeys.get(s.artwork_id) ?? s.artwork_id));
  const seen = new Set<string>();
  const out: SaleRow[] = [];
  for (const a of rows) {
    const key = workKeys.get(a.id) ?? a.id;
    if (!(a.is_sold || a.sold_at) || withLedger.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `artwork:${a.id}`,
      artwork_id: a.id,
      sold_to_account_id: a.sold_to_account_id,
      sold_to_email: a.sold_to_email,
      sold_to_name: a.sold_to_name,
      price_cents: a.sold_price_cents,
      sold_at: a.sold_at ?? '1970-01-01T00:00:00Z',
    });
  }
  return out;
}
