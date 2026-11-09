import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getChainArtworkIds } from '~/lib/provenance/chain';
import { logger } from '~/lib/logger';

type SaleDateRow = { sold_at: string | null };

/**
 * Distinct sales of one work. Rows on the same day are one sale (a sale
 * recorded on both the CoA and the show's CoS, or saved twice). Pure —
 * exported for tests.
 */
export function countDistinctSales(ledger: SaleDateRow[], soldCertificates: SaleDateRow[]): number {
  const days = new Set<string>();
  for (const row of ledger) days.add(row.sold_at ? row.sold_at.slice(0, 10) : 'undated');
  for (const row of soldCertificates) {
    const day = row.sold_at ? row.sold_at.slice(0, 10) : null;
    // A certificate marked sold with no ledger row on that day is a sale too.
    if (day ? !days.has(day) : days.size === 0) days.add(day ?? 'undated');
  }
  return days.size;
}

/**
 * How many times this work has sold, across every certificate of it
 * (CoA, CoS, CoO). Uses the admin client; returns 0 on error.
 */
export async function countChainSales(admin: SupabaseClient, artworkId: string): Promise<number> {
  try {
    const { ids } = await getChainArtworkIds(admin, artworkId);
    const db = asUntyped(admin);
    const [ledgerRes, soldRes] = await Promise.all([
      db.from('sales_ledger').select('sold_at').in('artwork_id', ids),
      db.from('artworks').select('sold_at').in('id', ids).or('is_sold.eq.true,sold_at.not.is.null'),
    ]);
    return countDistinctSales(
      (ledgerRes.data ?? []) as SaleDateRow[],
      (soldRes.data ?? []) as SaleDateRow[],
    );
  } catch (err) {
    logger.error('count_chain_sales_failed', { artworkId, error: err });
    return 0;
  }
}
