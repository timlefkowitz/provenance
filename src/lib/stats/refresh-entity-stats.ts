import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getUserRole, type UserRole, USER_ROLES } from '~/lib/user-roles';
import { logger } from '~/lib/logger';

type EntityRole = 'gallery' | 'artist' | 'institution' | 'collector';

function mapUserRoleToEntityRole(role: UserRole | null): EntityRole {
  if (role === USER_ROLES.GALLERY) return 'gallery';
  if (role === USER_ROLES.ARTIST) return 'artist';
  if (role === USER_ROLES.INSTITUTION) return 'institution';
  return 'collector';
}

export interface EntityStatsSnapshot {
  entity_account_id: string;
  entity_role: EntityRole;
  total_sales_count: number;
  total_sales_cents: number;
  average_sale_cents: number;
  last_sale_at: string | null;
  exhibition_count: number;
  museum_exhibition_count: number;
  represented_artwork_count: number;
  artworks_produced_count: number;
  market_cap_cents: number;
  auction_high_cents: number;
  auction_low_cents: number;
  auction_median_cents: number;
  scholarly_citations_count: number;
  forgery_risk_flag: boolean;
  rarity_index: number;
  updated_at: string;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

async function resolveEntityRole(accountId: string): Promise<EntityRole> {
  const admin = getSupabaseServerAdminClient();
  try {
    const { data } = await (admin as any)
      .from('accounts')
      .select('public_data')
      .eq('id', accountId)
      .maybeSingle();
    const role = getUserRole(data?.public_data as Record<string, any> | null);
    return mapUserRoleToEntityRole(role);
  } catch (err) {
    console.error('[Stats] resolveEntityRole failed', err);
    return 'collector';
  }
}

/**
 * Compute and upsert an entity_stats snapshot for one account.
 * Best-effort; failures are logged but never thrown.
 */
export async function refreshEntityStatsForAccount(accountId: string): Promise<void> {
  if (!accountId) return;

  console.log('[Stats] refreshEntityStatsForAccount started', { accountId });

  const admin = getSupabaseServerAdminClient();

  try {
    const role = await resolveEntityRole(accountId);

    const { data: soldBy } = await (admin as any)
      .from('sales_ledger')
      .select('price_cents, sold_at')
      .eq('sold_by_account_id', accountId);

    const { data: boughtBy } = await (admin as any)
      .from('sales_ledger')
      .select('price_cents, sold_at')
      .eq('sold_to_account_id', accountId);

    const sales = Array.isArray(soldBy) ? (soldBy as Array<any>) : [];
    const purchases = Array.isArray(boughtBy) ? (boughtBy as Array<any>) : [];

    const prices = sales
      .map((s) => (typeof s.price_cents === 'number' ? (s.price_cents as number) : 0))
      .filter((n) => n > 0);
    const totalSalesCents = prices.reduce((a, b) => a + b, 0);
    const totalSalesCount = sales.length;
    const averageSaleCents = prices.length ? Math.round(totalSalesCents / prices.length) : 0;
    const lastSaleAt = [...sales, ...purchases]
      .map((s) => (s.sold_at as string) || null)
      .filter((v): v is string => !!v)
      .sort()
      .reverse()[0] ?? null;

    const auctionHigh = prices.length ? Math.max(...prices) : 0;
    const auctionLow = prices.length ? Math.min(...prices) : 0;
    const auctionMedian = median(prices);

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const marketCapCents = sales
      .filter((s) => {
        const t = s.sold_at ? new Date(s.sold_at as string).getTime() : 0;
        return t >= threeYearsAgo.getTime();
      })
      .reduce((acc, s) => acc + (typeof s.price_cents === 'number' ? s.price_cents : 0), 0);

    const { count: representedCount } = await (admin as any)
      .from('artworks')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    const { count: producedCount } = await (admin as any)
      .from('artworks')
      .select('id', { count: 'exact', head: true })
      .eq('artist_account_id', accountId);

    let exhibitionCount = 0;
    let museumExhibitionCount = 0;
    try {
      const { count } = await (admin as any)
        .from('exhibitions')
        .select('id', { count: 'exact', head: true })
        .eq('gallery_id', accountId);
      exhibitionCount = count ?? 0;
    } catch {
      exhibitionCount = 0;
    }

    try {
      const { data: events } = await (admin as any)
        .from('provenance_events')
        .select('event_type, metadata')
        .eq('actor_account_id', accountId)
        .eq('event_type', 'exhibition');
      if (Array.isArray(events)) {
        museumExhibitionCount = events.filter((e: any) => {
          const venue = (e?.metadata?.venue_type as string) || '';
          return venue.toLowerCase().includes('museum');
        }).length;
      }
    } catch {
      museumExhibitionCount = 0;
    }

    const rarityIndex = (() => {
      const produced = producedCount ?? 0;
      if (produced <= 0) return 0;
      return Math.min(100, 100 / (1 + produced / 10));
    })();

    const payload: Partial<EntityStatsSnapshot> = {
      entity_account_id: accountId,
      entity_role: role,
      total_sales_count: totalSalesCount,
      total_sales_cents: totalSalesCents,
      average_sale_cents: averageSaleCents,
      last_sale_at: lastSaleAt,
      exhibition_count: exhibitionCount,
      museum_exhibition_count: museumExhibitionCount,
      represented_artwork_count: representedCount ?? 0,
      artworks_produced_count: producedCount ?? 0,
      market_cap_cents: marketCapCents,
      auction_high_cents: auctionHigh,
      auction_low_cents: auctionLow,
      auction_median_cents: auctionMedian,
      scholarly_citations_count: 0,
      forgery_risk_flag: false,
      rarity_index: Math.round(rarityIndex * 100) / 100,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await (admin as any)
      .from('entity_stats')
      .upsert(payload, { onConflict: 'entity_account_id,entity_role' });

    if (upsertError) {
      console.error('[Stats] refreshEntityStatsForAccount upsert failed', upsertError);
      logger.error('refresh_entity_stats_upsert_failed', { accountId, error: upsertError });
      return;
    }

    console.log('[Stats] refreshEntityStatsForAccount completed', {
      accountId,
      role,
      totalSalesCount,
    });
  } catch (err) {
    console.error('[Stats] refreshEntityStatsForAccount failed', err);
    logger.error('refresh_entity_stats_failed', { accountId, error: err });
  }
}

export async function refreshEntityStatsForAccounts(accountIds: string[]): Promise<void> {
  const unique = Array.from(new Set(accountIds.filter(Boolean)));
  if (!unique.length) return;
  console.log('[Stats] refreshEntityStatsForAccounts', { count: unique.length });
  for (const id of unique) {
    await refreshEntityStatsForAccount(id);
  }
}

/**
 * Admin-triggered: recompute stats for every account that appears as seller,
 * buyer, or artist in the ledger and artworks.
 */
export async function refreshAllEntityStats(): Promise<{
  accountsRefreshed: number;
  errors: string[];
}> {
  console.log('[Stats] refreshAllEntityStats started');
  const admin = getSupabaseServerAdminClient();
  const ids = new Set<string>();
  const errors: string[] = [];

  try {
    const { data: sellers } = await (admin as any)
      .from('sales_ledger')
      .select('sold_by_account_id, sold_to_account_id');
    if (Array.isArray(sellers)) {
      for (const row of sellers as Array<any>) {
        if (row.sold_by_account_id) ids.add(row.sold_by_account_id as string);
        if (row.sold_to_account_id) ids.add(row.sold_to_account_id as string);
      }
    }

    const { data: artworks } = await (admin as any)
      .from('artworks')
      .select('account_id, artist_account_id');
    if (Array.isArray(artworks)) {
      for (const row of artworks as Array<any>) {
        if (row.account_id) ids.add(row.account_id as string);
        if (row.artist_account_id) ids.add(row.artist_account_id as string);
      }
    }
  } catch (err) {
    console.error('[Stats] refreshAllEntityStats aggregation failed', err);
    errors.push((err as Error).message);
  }

  for (const id of Array.from(ids)) {
    await refreshEntityStatsForAccount(id);
  }

  console.log('[Stats] refreshAllEntityStats complete', { count: ids.size });
  return { accountsRefreshed: ids.size, errors };
}
