import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { attachProvenanceValues } from '~/lib/valuation/load-chain-provenance-values';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { loadGalleryRosterIds } from '~/lib/portal-graphs/load-gallery-roster-ids';
import { valueAt, type ArtworkValueRow, type ValuationRow } from '~/lib/portal-graphs/value-waterfall';

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
  groupCollectors,
  type CollectorSummary,
  type ExhibitionSellThrough,
  type SaleRow,
  type ShownLink,
} from './group-collectors';
import { loadOwnershipHolders } from './load-ownership-holders';

export interface GalleryExhibition {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface GalleryCollectorData {
  exhibitions: GalleryExhibition[];
  collectors: CollectorSummary[];
  sellThrough: ExhibitionSellThrough[];
}

const EMPTY: GalleryCollectorData = { exhibitions: [], collectors: [], sellThrough: [] };

type ArtworkRow = ArtworkValueRow & {
  source_artwork_id: string | null;
  is_sold: boolean | null;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
};

const ARTWORK_COLS =
  'id, source_artwork_id, is_sold, sold_at, sold_price_cents, sold_to_account_id, sold_to_email, sold_to_name, value';

/**
 * Everything the gallery collectors page needs: who bought, how much, which
 * shows they came from, and per-exhibition sell-through.
 *
 * Sales = sales_ledger rows sold by the gallery's owner account(s) or recorded
 * on any certificate of a roster / exhibition work (CoA, CoS or CoO), plus older
 * sales only stored on a certificate row. Unpriced sales count at the work's
 * set value, flagged estimated.
 */
export async function loadGalleryCollectorData(
  galleryProfileIds: string[],
): Promise<GalleryCollectorData> {
  console.log('[Collectors] loadGalleryCollectorData started', { galleryProfileIds });
  if (!galleryProfileIds.length) return EMPTY;

  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id')
      .in('id', galleryProfileIds);
    const ownerIds = Array.from(
      new Set(
        ((profiles ?? []) as Array<{ user_id: string | null }>)
          .map((p) => p.user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );

    const rosterIds = await loadGalleryRosterIds(admin, galleryProfileIds);

    const { data: exhibitionRows, error: exErr } = ownerIds.length
      ? await admin
          .from('exhibitions')
          .select('id, title, start_date, end_date, created_at')
          .in('gallery_id', ownerIds)
          .order('start_date', { ascending: false, nullsFirst: false })
      : { data: [], error: null };
    if (exErr) console.error('[Collectors] exhibitions fetch failed', exErr);
    const exhibitions = (exhibitionRows ?? []) as GalleryExhibition[];
    const exhibitionIds = exhibitions.map((e) => e.id);

    const { data: linkRows, error: linkErr } = exhibitionIds.length
      ? await admin
          .from('exhibition_artworks')
          .select('exhibition_id, artwork_id, status')
          .in('exhibition_id', exhibitionIds)
      : { data: [], error: null };
    if (linkErr) console.error('[Collectors] exhibition links fetch failed', linkErr);
    const shownLinks: ShownLink[] = ((linkRows ?? []) as Array<ShownLink & { status: string | null }>)
      .filter((l) => isShownInExhibition(l.status))
      .map(({ exhibition_id, artwork_id }) => ({ exhibition_id, artwork_id }));

    const galleryArtworkIds = Array.from(new Set([...rosterIds, ...shownLinks.map((l) => l.artwork_id)]));

    const { data: ownerSales } = ownerIds.length
      ? await admin.from('sales_ledger').select(LEDGER_SALE_COLS).in('sold_by_account_id', ownerIds)
      : { data: [] };

    // Every certificate of every gallery work: a sale may be recorded on the
    // artist's CoA, the show's CoS or the buyer's CoO.
    const chain = await expandChain(admin, [
      ...galleryArtworkIds,
      ...((ownerSales ?? []) as SaleRow[]).map((s) => s.artwork_id),
    ]);
    const workKeys = chain.workKeys;

    const ledgerById = new Map<string, SaleRow>();
    for (const row of [...(await loadLedgerSales(admin, chain.ids)), ...((ownerSales ?? []) as SaleRow[])]) {
      ledgerById.set(row.id, row);
    }
    const ledgerSales = Array.from(ledgerById.values());

    const galleryWorkKeys = new Set(galleryArtworkIds.map((id) => workKeys.get(id) ?? id));
    const soldRows = (await loadSoldRows(admin, chain.ids)).filter((r) =>
      galleryWorkKeys.has(workKeys.get(r.id) ?? r.id),
    );

    const sales = priceSales({
      sales: fillMissingBuyers(
        [...ledgerSales, ...artworkOnlySales(soldRows, ledgerSales, workKeys)],
        await inChunks(chain.ids, (ids) => loadOwnershipHolders(admin, ids)),
        workKeys,
      ),
      chain: chain.rows,
      workKeys,
      exhibitionCountByWork: await loadExhibitionCounts(admin, chain.ids, workKeys, chain.rows),
    });

    const soldArtworkIds = Array.from(new Set(sales.map((s) => s.artwork_id)));
    const valuationsByArtwork = new Map<string, ValuationRow[]>();
    if (soldArtworkIds.length) {
      const valRows = await inChunks(soldArtworkIds, async (ids) => {
        const { data } = await admin
          .from('artwork_valuations')
          .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
          .in('artwork_id', ids);
        return (data ?? []) as ValuationRow[];
      });
      for (const v of valRows) {
        if (!valuationsByArtwork.has(v.artwork_id)) valuationsByArtwork.set(v.artwork_id, []);
        valuationsByArtwork.get(v.artwork_id)!.push(v);
      }
    }
    const artworks = await inChunks(soldArtworkIds, async (ids) => {
      const { data } = await admin.from('artworks').select(ARTWORK_COLS).in('id', ids);
      return (data ?? []) as ArtworkRow[];
    });
    await attachProvenanceValues(admin, artworks);
    const now = new Date();
    const currentValueCents = new Map<string, number>();
    for (const a of artworks) {
      if (!soldArtworkIds.includes(a.id)) continue;
      // A formal valuation, else the work's chain-wide Provenance Value (the
      // figure every certificate shows). A buyer's own CoO figure or a bare
      // declared value never counts; groupCollectors then falls back to the price.
      const v = valueAt(a, valuationsByArtwork.get(a.id) ?? [], now);
      if ((v.source === 'formal_valuation' || v.source === 'provenance_value') && v.value_cents > 0) {
        currentValueCents.set(a.id, v.value_cents);
      }
    }

    const collectors = groupCollectors({ sales, workKeys, shownLinks, currentValueCents });

    // Fill in names/emails for platform buyers.
    const accountIds = collectors.map((c) => c.accountId).filter((id): id is string => !!id);
    if (accountIds.length) {
      const { data: accounts } = await admin
        .from('accounts')
        .select('id, name, email')
        .in('id', accountIds);
      const byId = new Map(
        ((accounts ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map((a) => [a.id, a]),
      );
      for (const c of collectors) {
        const account = c.accountId ? byId.get(c.accountId) : undefined;
        if (!account) continue;
        c.name = account.name || c.name;
        c.email = account.email || c.email;
      }
    }

    const sellThrough = computeSellThrough({ exhibitionIds, sales, workKeys, shownLinks });

    console.log('[Collectors] loadGalleryCollectorData complete', {
      exhibitions: exhibitions.length,
      sales: sales.length,
      collectors: collectors.length,
    });
    return { exhibitions, collectors, sellThrough };
  } catch (err) {
    console.error('[Collectors] loadGalleryCollectorData failed', err);
    return EMPTY;
  }
}
