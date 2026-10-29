import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { loadGalleryRosterIds } from '~/lib/portal-graphs/load-gallery-roster-ids';
import { valueAt, type ArtworkValueRow, type ValuationRow } from '~/lib/portal-graphs/value-waterfall';

import {
  buildWorkKeys,
  computeSellThrough,
  groupCollectors,
  type CollectorSummary,
  type ExhibitionSellThrough,
  type SaleRow,
  type ShownLink,
} from './group-collectors';

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
 * on a roster / exhibition work, plus older sales only stored on the artwork row.
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

    const ledgerCols =
      'id, artwork_id, sold_to_account_id, sold_to_email, sold_to_name, price_cents, sold_at';
    const [bySeller, byArtwork] = await Promise.all([
      ownerIds.length
        ? admin.from('sales_ledger').select(ledgerCols).in('sold_by_account_id', ownerIds)
        : { data: [] },
      galleryArtworkIds.length
        ? admin.from('sales_ledger').select(ledgerCols).in('artwork_id', galleryArtworkIds)
        : { data: [] },
    ]);
    const ledgerById = new Map<string, SaleRow>();
    for (const row of [...(bySeller.data ?? []), ...(byArtwork.data ?? [])] as SaleRow[]) {
      ledgerById.set(row.id, row);
    }
    const ledgerSales = Array.from(ledgerById.values());

    const artworkIds = Array.from(new Set([...galleryArtworkIds, ...ledgerSales.map((s) => s.artwork_id)]));
    const { data: artworkRows, error: artErr } = artworkIds.length
      ? await admin.from('artworks').select(ARTWORK_COLS).in('id', artworkIds)
      : { data: [], error: null };
    if (artErr) console.error('[Collectors] artworks fetch failed', artErr);
    const artworks = (artworkRows ?? []) as ArtworkRow[];
    const workKeys = buildWorkKeys(artworks);

    // Older sales were only stored on the artwork row; include those for works
    // with no ledger entry on any of their certificates.
    const worksWithLedgerSale = new Set(ledgerSales.map((s) => workKeys.get(s.artwork_id) ?? s.artwork_id));
    const galleryArtworkSet = new Set(galleryArtworkIds);
    const artworkOnlySales: SaleRow[] = artworks
      .filter(
        (a) =>
          galleryArtworkSet.has(a.id) &&
          a.is_sold &&
          a.sold_at &&
          !worksWithLedgerSale.has(workKeys.get(a.id) ?? a.id),
      )
      .map((a) => ({
        id: `artwork:${a.id}`,
        artwork_id: a.id,
        sold_to_account_id: a.sold_to_account_id,
        sold_to_email: a.sold_to_email,
        sold_to_name: a.sold_to_name,
        price_cents: a.sold_price_cents,
        sold_at: a.sold_at!,
      }));
    const sales = [...ledgerSales, ...artworkOnlySales];

    const soldArtworkIds = Array.from(new Set(sales.map((s) => s.artwork_id)));
    const valuationsByArtwork = new Map<string, ValuationRow[]>();
    if (soldArtworkIds.length) {
      const { data: valRows } = await admin
        .from('artwork_valuations')
        .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
        .in('artwork_id', soldArtworkIds);
      for (const v of (valRows ?? []) as ValuationRow[]) {
        if (!valuationsByArtwork.has(v.artwork_id)) valuationsByArtwork.set(v.artwork_id, []);
        valuationsByArtwork.get(v.artwork_id)!.push(v);
      }
    }
    const now = new Date();
    const currentValueCents = new Map<string, number>();
    for (const a of artworks) {
      if (!soldArtworkIds.includes(a.id)) continue;
      currentValueCents.set(a.id, valueAt(a, valuationsByArtwork.get(a.id) ?? [], now).value_cents);
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
