import { saleAmountCents, type SaleRow, type ShownLink } from '~/lib/collectors/group-collectors';

/**
 * Sales grouped for the portal: totals, per exhibition, per artist. Recorded
 * prices are kept apart from set-value estimates; Provenance Value sits
 * alongside. Pure — loaders pass already-priced sales (priceSales).
 */

export interface MoneyTotals {
  salesCount: number;
  recordedCents: number;
  estimatedCents: number;
  provenanceValueCents: number;
}

export interface ExhibitionSalesRow extends MoneyTotals {
  exhibitionId: string;
  title: string;
  startDate: string | null;
  shownCount: number;
  sellThroughPct: number;
}

export interface ArtistSalesRow extends MoneyTotals {
  artist: string;
}

export interface SalesBreakdown {
  totals: MoneyTotals;
  byExhibition: ExhibitionSalesRow[];
  byArtist: ArtistSalesRow[];
}

const empty = (): MoneyTotals => ({ salesCount: 0, recordedCents: 0, estimatedCents: 0, provenanceValueCents: 0 });

function add(t: MoneyTotals, sale: SaleRow): void {
  const amount = saleAmountCents(sale);
  t.salesCount += 1;
  if (sale.money?.estimated) t.estimatedCents += amount;
  else t.recordedCents += amount;
  t.provenanceValueCents += sale.provenance_value_cents ?? amount;
}

export function buildSalesBreakdown(params: {
  sales: SaleRow[];
  workKeys: Map<string, string>;
  shownLinks: ShownLink[];
  exhibitions: Array<{ id: string; title: string; start_date: string | null }>;
  artistByWork: Map<string, string>;
}): SalesBreakdown {
  const keyOf = (id: string) => params.workKeys.get(id) ?? id;

  const totals = empty();
  for (const s of params.sales) add(totals, s);

  // A show is credited with the first sale of each work it hung.
  const firstSale = new Map<string, SaleRow>();
  for (const s of params.sales) {
    const k = keyOf(s.artwork_id);
    const prev = firstSale.get(k);
    if (!prev || s.sold_at < prev.sold_at) firstSale.set(k, s);
  }

  const worksByShow = new Map<string, Set<string>>();
  for (const l of params.shownLinks) {
    if (!worksByShow.has(l.exhibition_id)) worksByShow.set(l.exhibition_id, new Set());
    worksByShow.get(l.exhibition_id)!.add(keyOf(l.artwork_id));
  }

  const byExhibition: ExhibitionSalesRow[] = [];
  for (const ex of params.exhibitions) {
    const works = worksByShow.get(ex.id);
    if (!works?.size) continue;
    const t = empty();
    for (const w of works) {
      const s = firstSale.get(w);
      if (s) add(t, s);
    }
    byExhibition.push({
      exhibitionId: ex.id,
      title: ex.title,
      startDate: ex.start_date,
      shownCount: works.size,
      sellThroughPct: Math.round((t.salesCount / works.size) * 100),
      ...t,
    });
  }

  const artists = new Map<string, MoneyTotals>();
  for (const s of params.sales) {
    const name = params.artistByWork.get(keyOf(s.artwork_id)) ?? 'Unknown artist';
    if (!artists.has(name)) artists.set(name, empty());
    add(artists.get(name)!, s);
  }
  const byArtist = Array.from(artists, ([artist, t]) => ({ artist, ...t })).sort(
    (a, b) =>
      b.recordedCents + b.estimatedCents - (a.recordedCents + a.estimatedCents) || b.salesCount - a.salesCount,
  );

  return { totals, byExhibition, byArtist };
}
