import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { getRoleLabel, type UserRole, USER_ROLES } from '~/lib/user-roles';

type EntityRole = 'gallery' | 'artist' | 'institution' | 'collector';

export interface EntityStatsRow {
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
  updated_at: string | null;
}

export interface RecentSaleRow {
  id: string;
  artwork_id: string;
  sold_at: string;
  price_cents: number | null;
  currency: string;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
  notes: string | null;
}

interface EntityStatsDashboardProps {
  accountId: string;
  role: UserRole;
  /** When true, includes the sales_ledger list for this account (seller side). */
  includeSales?: boolean;
  className?: string;
}

function mapUserRoleToEntityRole(role: UserRole | null): EntityRole {
  if (role === USER_ROLES.GALLERY) return 'gallery';
  if (role === USER_ROLES.ARTIST) return 'artist';
  if (role === USER_ROLES.INSTITUTION) return 'institution';
  return 'collector';
}

function formatMoney(cents: number, currency = 'USD'): string {
  if (!cents) return `${currency} 0`;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString()}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

async function loadStats(
  accountId: string,
  entityRole: EntityRole,
): Promise<EntityStatsRow | null> {
  const admin = getSupabaseServerAdminClient();
  try {
    const { data, error } = await (admin as any)
      .from('entity_stats')
      .select('*')
      .eq('entity_account_id', accountId)
      .eq('entity_role', entityRole)
      .maybeSingle();
    if (error) {
      console.error('[Stats] loadStats failed', error);
      return null;
    }
    return (data as EntityStatsRow) ?? null;
  } catch (err) {
    console.error('[Stats] loadStats exception', err);
    return null;
  }
}

async function loadRecentSales(accountId: string): Promise<RecentSaleRow[]> {
  const admin = getSupabaseServerAdminClient();
  try {
    const { data, error } = await (admin as any)
      .from('sales_ledger')
      .select(
        'id, artwork_id, sold_at, price_cents, currency, sold_to_account_id, sold_to_email, sold_to_name, notes',
      )
      .eq('sold_by_account_id', accountId)
      .order('sold_at', { ascending: false })
      .limit(25);
    if (error) {
      console.error('[Stats] loadRecentSales failed', error);
      return [];
    }
    return (data as RecentSaleRow[]) ?? [];
  } catch (err) {
    console.error('[Stats] loadRecentSales exception', err);
    return [];
  }
}

export async function EntityStatsDashboard({
  accountId,
  role,
  includeSales = true,
  className,
}: EntityStatsDashboardProps) {
  const entityRole = mapUserRoleToEntityRole(role);
  const stats = await loadStats(accountId, entityRole);
  const recentSales = includeSales ? await loadRecentSales(accountId) : [];

  const tiles = [
    {
      label: 'Total sales',
      value: String(stats?.total_sales_count ?? 0),
    },
    {
      label: 'Total volume',
      value: formatMoney(stats?.total_sales_cents ?? 0),
    },
    {
      label: 'Average sale',
      value: formatMoney(stats?.average_sale_cents ?? 0),
    },
    {
      label: 'Last sale',
      value: formatDate(stats?.last_sale_at ?? null),
    },
    {
      label: 'Market cap (3y)',
      value: formatMoney(stats?.market_cap_cents ?? 0),
    },
    {
      label: 'Auction high',
      value: formatMoney(stats?.auction_high_cents ?? 0),
    },
    {
      label: 'Auction median',
      value: formatMoney(stats?.auction_median_cents ?? 0),
    },
    {
      label:
        entityRole === 'artist'
          ? 'Works produced'
          : entityRole === 'gallery' || entityRole === 'institution'
          ? 'Represented works'
          : 'Owned works',
      value: String(
        entityRole === 'artist'
          ? stats?.artworks_produced_count ?? 0
          : stats?.represented_artwork_count ?? 0,
      ),
    },
    {
      label: 'Exhibitions',
      value: String(stats?.exhibition_count ?? 0),
    },
    {
      label: 'Museum exhibitions',
      value: String(stats?.museum_exhibition_count ?? 0),
    },
    {
      label: 'Scholarly citations',
      value: String(stats?.scholarly_citations_count ?? 0),
    },
    {
      label: 'Rarity index',
      value: String(stats?.rarity_index ?? 0),
    },
  ];

  return (
    <section className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">
            {getRoleLabel(role)} stats
          </CardTitle>
          <p className="text-xs text-ink/60 font-serif">
            Last refreshed {formatDate(stats?.updated_at ?? null)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-md border border-wine/15 bg-parchment/60 p-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-ink/50 font-serif">
                  {tile.label}
                </p>
                <p className="mt-1 text-lg font-serif text-ink">{tile.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {includeSales ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Recent sales ledger
            </CardTitle>
            <p className="text-xs text-ink/60 font-serif">
              Who you sold to, when, and for how much.
            </p>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-ink/60 font-serif">
                No recorded sales yet. Mark an artwork as sold from the collection editor to add entries here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-serif">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Buyer</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((row) => (
                      <tr key={row.id} className="border-t border-wine/10 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDate(row.sold_at)}
                        </td>
                        <td className="py-2 pr-3">
                          {row.sold_to_name ||
                            row.sold_to_email ||
                            (row.sold_to_account_id ? 'Platform account' : 'Unknown')}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.price_cents
                            ? formatMoney(row.price_cents, row.currency || 'USD')
                            : '—'}
                        </td>
                        <td className="py-2 pr-3 text-ink/70">
                          {row.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
