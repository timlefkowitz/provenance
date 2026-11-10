import { asUntyped } from '~/lib/supabase-untyped';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getChainArtworkIds } from '~/lib/provenance/chain';
import { logger } from '~/lib/logger';

import { countDistinctSales, type SaleDateRow } from '~/lib/sales/sale-money';

export { countDistinctSales };

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
