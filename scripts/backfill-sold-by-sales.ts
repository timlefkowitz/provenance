#!/usr/bin/env tsx
/**
 * Works with the free-text "Sold by" filled in but never marked sold get a
 * recorded sale (decided 2026-11-09). One sale per work: certificates linked
 * by source_artwork_id are one work, and a work that already has a sale on
 * any certificate is skipped.
 *
 * No sale date was ever entered, so the date is the certificate's last edit
 * (when "Sold by" was most likely written). The buyer is "Owned by" when it
 * names someone other than the seller. Mirrors recordSale's writes: sold
 * columns, a sales_ledger row, a 'sale' provenance event. Run
 * backfill-sale-provenance.ts afterwards for the "Sold, <date>" lines.
 *
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-sold-by-sales.ts --dry-run
 *   pnpm dotenv -e ./.env.local -- tsx scripts/backfill-sold-by-sales.ts
 */
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Art = {
  id: string;
  title: string | null;
  account_id: string;
  source_artwork_id: string | null;
  is_sold: boolean | null;
  sold_at: string | null;
  sold_by: string | null;
  owned_by: string | null;
  updated_at: string | null;
  created_at: string;
};
const COLS = 'id, title, account_id, source_artwork_id, is_sold, sold_at, sold_by, owned_by, updated_at, created_at';

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

async function main() {
  const { data, error } = await db
    .from('artworks')
    .select(COLS)
    .not('sold_by', 'is', null)
    .neq('sold_by', '')
    .eq('is_sold', false)
    .is('sold_at', null);
  if (error) throw error;
  const candidates = (data ?? []) as Art[];

  const done = new Set<string>();
  let recorded = 0;
  for (const art of candidates) {
    // The whole work: walk to the root, then every certificate under it.
    let rootId = art.id;
    for (let i = 0; i < 64; i++) {
      const { data: row } = await db.from('artworks').select('id, source_artwork_id').eq('id', rootId).maybeSingle();
      if (!row?.source_artwork_id) break;
      rootId = row.source_artwork_id as string;
    }
    if (done.has(rootId)) continue;
    done.add(rootId);

    const chain = new Map<string, Art>();
    for (let frontier = [rootId], i = 0; frontier.length && i < 64; i++) {
      const [{ data: self }, { data: kids }] = await Promise.all([
        db.from('artworks').select(COLS).in('id', frontier),
        db.from('artworks').select(COLS).in('source_artwork_id', frontier),
      ]);
      frontier = [];
      for (const r of [...(self ?? []), ...(kids ?? [])] as Art[]) {
        if (!chain.has(r.id)) {
          chain.set(r.id, r);
          frontier.push(r.id);
        }
      }
    }
    const ids = [...chain.keys()];
    const { data: ledger } = await db.from('sales_ledger').select('id').in('artwork_id', ids).limit(1);
    if ([...chain.values()].some((c) => c.is_sold || c.sold_at) || ledger?.length) {
      console.log(`skip  ${art.title} (${art.id}): already sold on a linked certificate`);
      continue;
    }

    // Record on the root certificate; the latest edit across the work is the date.
    const root = chain.get(rootId)!;
    const soldAt = [...chain.values()]
      .filter((c) => c.sold_by?.trim())
      .map((c) => c.updated_at ?? c.created_at)
      .sort()
      .at(-1)!;
    const seller = root.sold_by?.trim() || art.sold_by!.trim();
    const owner = [...chain.values()].map((c) => c.owned_by?.trim()).find(Boolean) ?? null;
    const buyerName = owner && norm(owner) !== norm(seller) ? owner : null;

    console.log(
      `${dryRun ? '[dry-run] ' : ''}${soldAt.slice(0, 10)}  ${root.title} (${rootId}, ${ids.length} cert)  sold by "${seller}"${buyerName ? ` to "${buyerName}"` : ''}`,
    );
    recorded++;
    if (dryRun) continue;

    const { error: upErr } = await db
      .from('artworks')
      .update({
        is_sold: true,
        sold_by_account_id: root.account_id,
        sold_to_name: buyerName,
        sold_currency: 'USD',
        sold_at: soldAt,
      })
      .eq('id', rootId);
    if (upErr) {
      console.error('  artwork update failed', upErr.message);
      continue;
    }

    const metadata = { source: 'sold_by_backfill', sold_by_display: seller, date_basis: 'last_edit' };
    const { data: sale, error: saleErr } = await db
      .from('sales_ledger')
      .insert({
        artwork_id: rootId,
        sold_by_account_id: root.account_id,
        sold_to_name: buyerName,
        price_cents: null,
        currency: 'USD',
        sold_at: soldAt,
        recorded_by: null,
        notes: `Recorded from "Sold by: ${seller}"`,
        metadata,
      })
      .select('id')
      .single();
    if (saleErr) console.error('  ledger insert failed', saleErr.message);

    const { error: evErr } = await db.from('provenance_events').insert({
      artwork_id: rootId,
      event_type: 'sale',
      actor_account_id: null,
      event_date: soldAt,
      metadata: {
        ...metadata,
        sold_by_account_id: root.account_id,
        sold_to_name: buyerName,
        price_cents: null,
        currency: 'USD',
        sale_id: sale?.id ?? null,
      },
    });
    if (evErr) console.error('  provenance event failed', evErr.message);
  }

  console.log(`\n${dryRun ? 'Would record' : 'Recorded'} ${recorded} sale(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
