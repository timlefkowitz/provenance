import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { getRoleLabel, type UserRole, USER_ROLES } from '~/lib/user-roles';
import { loadAccountSales, type CreditedSale } from '~/lib/sales/load-account-sales';
import { buildSalesBreakdown, type SalesBreakdown } from '~/lib/portal-graphs/sales-breakdown';

import { SalesBreakdownSection } from './sales-breakdown-section';

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
    const { data, error } = await asUntyped(admin)
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

async function loadSalesView(
  accountId: string,
): Promise<{ breakdown: SalesBreakdown; recent: CreditedSale[]; titles: Map<string, string> } | null> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  try {
    const data = await loadAccountSales(admin, accountId);
    const breakdown = buildSalesBreakdown(data);
    const recent = [...data.sales].sort((a, b) => b.sold_at.localeCompare(a.sold_at)).slice(0, 25);
    const { data: rows } = recent.length
      ? await admin.from('artworks').select('id, title').in('id', recent.map((s) => s.artwork_id))
      : { data: [] };
    const titles = new Map(((rows ?? []) as Array<{ id: string; title: string | null }>).map((r) => [r.id, r.title ?? '']));
    return { breakdown, recent, titles };
  } catch (err) {
    console.error('[Stats] loadSalesView failed', err);
    return null;
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
  const salesView = includeSales ? await loadSalesView(accountId) : null;

  const tiles = [
    {
      label: 'Total sales',
      value: String(stats?.total_sales_count ?? 0),
    },
    {
      label: 'Recorded volume',
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
      label: 'Recorded volume (3y)',
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
        <div className="mt-6">
          {salesView ? (
            <SalesBreakdownSection
              breakdown={salesView.breakdown}
              recent={salesView.recent}
              titles={salesView.titles}
            />
          ) : (
            <p className="text-sm text-ink/60 font-serif">Couldn&apos;t load sales right now.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
