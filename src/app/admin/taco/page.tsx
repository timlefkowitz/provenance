import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import {
  adminMonoLabel,
  adminPanel,
  adminPanelInner,
} from '../_components/admin-dash-tokens';

export const metadata = {
  title: 'Taco usage | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type UsageRow = {
  user_id: string;
  created_at: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  agent_iterations: number;
  had_images: boolean;
  had_docs: boolean;
  estimated_cost_usd: number;
};

type UnhandledRow = {
  id: string;
  user_id: string;
  user_message: string;
  taco_summary: string;
  pathname: string | null;
  resolved: boolean;
  admin_note: string | null;
  created_at: string;
  // joined
  email: string | null;
  name: string | null;
};

type AccountRow = { id: string; email: string | null; name: string | null };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatRelative(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function fmtCost(n: number): string {
  if (n < 0.000001) return '$0.000000';
  return `$${n.toFixed(6)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function bestLabel(row: { name: string | null; email: string | null; id: string }): string {
  return row.name || row.email || row.id.slice(0, 8);
}

function Avatar({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#1793d1]/30 bg-[#1793d1]/10 font-mono text-xs font-semibold text-[#67d4ff]">
      {initial}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data loaders                                                              */
/* -------------------------------------------------------------------------- */

async function fetchAccountsByIds(ids: string[]): Promise<Map<string, AccountRow>> {
  const map = new Map<string, AccountRow>();
  if (ids.length === 0) return map;
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.from('accounts').select('id, email, name').in('id', ids);
  if (error) {
    console.error('[AdminTaco] accounts fetch failed', error);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id as string, row as AccountRow);
  }
  return map;
}

async function loadAggregates() {
  const admin = getSupabaseServerAdminClient();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const monthIso = startOfMonth.toISOString();

  const [allTime, thisMonth] = await Promise.all([
    (admin as any)
      .from('taco_usage_logs')
      .select('total_tokens, estimated_cost_usd, user_id', { count: 'exact' }),
    (admin as any)
      .from('taco_usage_logs')
      .select('total_tokens, estimated_cost_usd, user_id', { count: 'exact' })
      .gte('created_at', monthIso),
  ]);

  const summarise = (rows: UsageRow[] | null, count: number | null) => {
    const r = rows ?? [];
    return {
      requests: count ?? 0,
      tokens: r.reduce((s, x) => s + (x.total_tokens ?? 0), 0),
      cost: r.reduce((s, x) => s + Number(x.estimated_cost_usd ?? 0), 0),
      uniqueUsers: new Set(r.map((x) => x.user_id)).size,
    };
  };

  return {
    allTime: summarise(allTime.data, allTime.count),
    month: summarise(thisMonth.data, thisMonth.count),
  };
}

async function loadTopUsers(limit = 10) {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await (admin as any)
    .from('taco_usage_logs')
    .select('user_id, total_tokens, estimated_cost_usd')
    .order('created_at', { ascending: false })
    .limit(500); // pull enough rows to aggregate client-side

  if (error) {
    console.error('[AdminTaco] top users query failed', error);
    return [];
  }

  // Aggregate per user
  const byUser = new Map<
    string,
    { requests: number; tokens: number; cost: number }
  >();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const existing = byUser.get(uid) ?? { requests: 0, tokens: 0, cost: 0 };
    existing.requests += 1;
    existing.tokens += Number(row.total_tokens ?? 0);
    existing.cost += Number(row.estimated_cost_usd ?? 0);
    byUser.set(uid, existing);
  }

  const sorted = [...byUser.entries()]
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, limit);

  const accounts = await fetchAccountsByIds(sorted.map(([id]) => id));

  return sorted.map(([id, stats]) => {
    const acc = accounts.get(id);
    return {
      id,
      email: acc?.email ?? null,
      name: acc?.name ?? null,
      ...stats,
    };
  });
}

async function loadUnhandledRequests(limit = 50): Promise<UnhandledRow[]> {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await (admin as any)
    .from('taco_unhandled_requests')
    .select('id, user_id, user_message, taco_summary, pathname, resolved, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AdminTaco] unhandled_requests query failed', error);
    return [];
  }

  const rows = (data ?? []) as Omit<UnhandledRow, 'email' | 'name'>[];
  const accounts = await fetchAccountsByIds([...new Set(rows.map((r) => r.user_id))]);

  return rows.map((r) => {
    const acc = accounts.get(r.user_id);
    return { ...r, email: acc?.email ?? null, name: acc?.name ?? null };
  });
}

async function loadRecentRows(limit = 20) {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await (admin as any)
    .from('taco_usage_logs')
    .select(
      'user_id, created_at, prompt_tokens, completion_tokens, total_tokens, agent_iterations, had_images, had_docs, estimated_cost_usd',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AdminTaco] recent rows query failed', error);
    return [];
  }

  const rows = (data ?? []) as UsageRow[];
  const accounts = await fetchAccountsByIds([...new Set(rows.map((r) => r.user_id))]);

  return rows.map((r) => {
    const acc = accounts.get(r.user_id);
    return { ...r, email: acc?.email ?? null, name: acc?.name ?? null };
  });
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function AdminTacoPage() {
  await requireAdmin();

  const [aggregates, topUsers, recentRows, unhandledRows] = await Promise.all([
    loadAggregates(),
    loadTopUsers(),
    loadRecentRows(),
    loadUnhandledRequests(),
  ]);

  console.log('[AdminTaco] page loaded', {
    allTimeRequests: aggregates.allTime.requests,
    monthRequests: aggregates.month.requests,
    topUsers: topUsers.length,
    recentRows: recentRows.length,
    unhandledRows: unhandledRows.length,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-[#1793d1]/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
            <span className="text-[#67d4ff]">$</span> provenance-admin — taco-usage
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            taco_usage_logs
          </h1>
          <p className="mt-2 max-w-xl font-mono text-sm text-slate-500">
            Token spend and user activity for the Taco AI assistant.
            Cost estimates use gpt-4o rates ($2.50/1M input · $10/1M output) — authoritative
            billing is in the OpenAI dashboard.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 font-mono text-xs text-slate-500 hover:text-slate-300"
        >
          ← overview
        </Link>
      </header>

      {/* Aggregate stats */}
      <section>
        <p className={`${adminMonoLabel} mb-3`}>aggregate_stats</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'total_requests',
              allTime: aggregates.allTime.requests.toLocaleString(),
              month: aggregates.month.requests.toLocaleString(),
              desc: 'all-time · this month',
            },
            {
              label: 'total_tokens',
              allTime: fmtTokens(aggregates.allTime.tokens),
              month: fmtTokens(aggregates.month.tokens),
              desc: 'prompt + completion',
            },
            {
              label: 'estimated_cost',
              allTime: fmtCost(aggregates.allTime.cost),
              month: fmtCost(aggregates.month.cost),
              desc: 'approx. gpt-4o rates',
            },
            {
              label: 'unique_users',
              allTime: String(aggregates.allTime.uniqueUsers),
              month: String(aggregates.month.uniqueUsers),
              desc: 'distinct user_ids',
            },
          ].map((stat) => (
            <Card key={stat.label} className={adminPanel}>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm font-medium text-[#67d4ff]">
                  {stat.label}
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  {stat.desc}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {stat.allTime}
                </p>
                <p className="mt-1 font-mono text-[12px] tabular-nums text-[#1793d1]/80">
                  {stat.month} <span className="text-slate-600">this month</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Top users + Recent rows */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top users leaderboard */}
        <section>
          <p className={`${adminMonoLabel} mb-3`}>top_users_by_requests</p>
          <Card className={adminPanel}>
            <CardHeader className="border-b border-[#1793d1]/15 pb-4">
              <CardTitle className="font-mono text-sm text-[#67d4ff]">leaderboard</CardTitle>
              <CardDescription className="font-mono text-[11px] text-slate-500">
                top 10 by request count (last 500 rows)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {topUsers.length === 0 ? (
                <p className="font-mono text-[13px] text-slate-500">
                  no usage yet — run the migration and use Taco.
                </p>
              ) : (
                <ol className="space-y-2">
                  {topUsers.map((u, idx) => (
                    <li
                      key={u.id}
                      className={cn(
                        'flex items-center gap-2 rounded-sm px-1.5 py-1.5',
                        idx === 0 && 'bg-[#1793d1]/10',
                      )}
                    >
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-500">
                        {idx + 1}
                      </span>
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] text-slate-200">
                          {bestLabel(u)}
                        </p>
                        {u.name && u.email && (
                          <p className="truncate font-mono text-[11px] text-slate-500">{u.email}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[13px] tabular-nums text-[#67d4ff]">
                          {u.requests.toLocaleString()} req
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-500">
                          {fmtTokens(u.tokens)} · {fmtCost(u.cost)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recent requests */}
        <section>
          <p className={`${adminMonoLabel} mb-3`}>recent_requests</p>
          <Card className={adminPanel}>
            <CardHeader className="border-b border-[#1793d1]/15 pb-4">
              <CardTitle className="font-mono text-sm text-[#67d4ff]">last_20</CardTitle>
              <CardDescription className="font-mono text-[11px] text-slate-500">
                most recent taco_usage_logs rows
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {recentRows.length === 0 ? (
                <p className="font-mono text-[13px] text-slate-500">no rows yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentRows.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-sm border border-[#1793d1]/10 bg-[#0f1318] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] text-slate-200">
                          {bestLabel({ name: r.name, email: r.email, id: r.user_id })}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {fmtTokens(r.total_tokens)} tokens ·{' '}
                          {fmtCost(Number(r.estimated_cost_usd))} ·{' '}
                          {r.agent_iterations} iter
                          {r.had_images && (
                            <span className="ml-1 text-[#1793d1]/70">·img</span>
                          )}
                          {r.had_docs && (
                            <span className="ml-1 text-[#1793d1]/70">·doc</span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-600">
                        {formatRelative(r.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Unhandled requests (feature wishlist) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className={adminMonoLabel}>taco_unhandled_requests</p>
          <span className="font-mono text-[11px] text-slate-500">
            {unhandledRows.filter((r) => !r.resolved).length} open ·{' '}
            {unhandledRows.length} total
          </span>
        </div>
        <Card className={adminPanel}>
          <CardHeader className="border-b border-[#1793d1]/15 pb-4">
            <CardTitle className="font-mono text-sm text-[#67d4ff]">
              feature_wishlist
            </CardTitle>
            <CardDescription className="font-mono text-[11px] text-slate-500">
              requests Taco could not fulfil — product gaps and missing actions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {unhandledRows.length === 0 ? (
              <p className="font-mono text-[13px] text-slate-500">
                no unhandled requests yet — Taco is handling everything 🐱
              </p>
            ) : (
              <ul className="space-y-3">
                {unhandledRows.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      'rounded-sm border px-4 py-3',
                      r.resolved
                        ? 'border-[#1793d1]/10 bg-[#0a0d12] opacity-50'
                        : 'border-[#1793d1]/20 bg-[#0f1318]',
                    )}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[12px] font-semibold text-slate-200">
                        {bestLabel({ name: r.name, email: r.email, id: r.user_id })}
                      </span>
                      {r.pathname && (
                        <span className="font-mono text-[11px] text-[#1793d1]/60">
                          {r.pathname}
                        </span>
                      )}
                      {r.resolved && (
                        <span className="rounded-sm border border-emerald-700/40 bg-emerald-900/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                          resolved
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-slate-600">
                        {formatRelative(r.created_at)}
                      </span>
                    </div>
                    {/* What Taco summarised the request as */}
                    <p className="mb-1 font-mono text-[13px] leading-snug text-[#67d4ff]">
                      {r.taco_summary}
                    </p>
                    {/* The raw user message */}
                    <p className="truncate font-mono text-[11px] text-slate-500" title={r.user_message}>
                      <span className="text-slate-600">raw: </span>
                      {r.user_message}
                    </p>
                    {r.admin_note && (
                      <p className="mt-1.5 font-mono text-[11px] text-amber-400/80">
                        <span className="text-slate-600">note: </span>
                        {r.admin_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Empty state hint */}
      {aggregates.allTime.requests === 0 && (
        <Card className={cn(adminPanelInner, 'border-[#1793d1]/15')}>
          <CardContent className="py-6">
            <p className="font-mono text-[13px] leading-relaxed text-slate-400">
              <span className="text-[#67d4ff]">$</span> no rows in{' '}
              <code className="text-[#67d4ff]/80">taco_usage_logs</code> yet.
              <br />
              run migration{' '}
              <code className="text-[#67d4ff]/80">20260625000000_taco_usage_logs</code>,
              then send a message in{' '}
              <a href="/taco" className="text-[#67d4ff] hover:underline">
                /taco
              </a>{' '}
              — the first row will appear here within seconds.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
