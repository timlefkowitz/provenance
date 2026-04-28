import {
  Activity,
  Clock,
  Flame,
  LogIn,
  MousePointerClick,
  Upload,
  UserPlus,
} from 'lucide-react';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import { adminMonoLabel, adminPanel, adminPanelInner } from './admin-dash-tokens';

const ONLINE_WINDOW_MINUTES = 5;
const RECENT_SIGN_IN_LIMIT = 12;
const TOP_TIME_LIMIT = 12;
const RECENT_LAST_SEEN_LIMIT = 20;
const STREAK_LEADERS_LIMIT = 8;
const TOP_UPLOADERS_LIMIT = 8;
const NEWEST_ACCOUNTS_LIMIT = 12;

type AccountRow = {
  id: string;
  email: string | null;
  name: string | null;
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAccountCreated(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes < 1) return '0m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function bestLabel(row: { name: string | null; email: string | null; id: string }) {
  return row.name || row.email || row.id.slice(0, 8);
}

async function fetchAccountsByIds(ids: string[]): Promise<Map<string, AccountRow>> {
  const map = new Map<string, AccountRow>();
  if (ids.length === 0) return map;

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('id, email, name')
    .in('id', ids);

  if (error) {
    console.error('[AdminUserAnalytics] accounts fetch failed', error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id as string, row as AccountRow);
  }
  return map;
}

async function loadRecentSignIns() {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    console.error('[AdminUserAnalytics] listUsers failed', error);
    return [];
  }

  return (data?.users ?? [])
    .filter((u) => Boolean(u.last_sign_in_at))
    .sort((a, b) => {
      const aT = new Date(a.last_sign_in_at ?? 0).getTime();
      const bT = new Date(b.last_sign_in_at ?? 0).getTime();
      return bT - aT;
    })
    .slice(0, RECENT_SIGN_IN_LIMIT)
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name:
        ((u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null) ||
        null,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));
}

async function loadOnlineNow() {
  const admin = getSupabaseServerAdminClient();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, count } = await (admin as any)
    .from('user_presence')
    .select('user_id, last_seen_at, total_active_minutes', {
      count: 'exact',
    })
    .gte('last_seen_at', cutoff)
    .order('last_seen_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('[AdminUserAnalytics] online query failed', error);
    return { rows: [], total: 0 };
  }

  const ids = (data ?? []).map((r) => r.user_id as string);
  const accounts = await fetchAccountsByIds(ids);

  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => {
      const acc = accounts.get(r.user_id as string);
      return {
        id: r.user_id as string,
        email: acc?.email ?? null,
        name: acc?.name ?? null,
        lastSeenAt: r.last_seen_at as string,
        totalActiveMinutes: r.total_active_minutes as number,
      };
    }),
  };
}

async function loadRecentByLastSeen() {
  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('user_presence')
    .select('user_id, last_seen_at, total_active_minutes')
    .order('last_seen_at', { ascending: false })
    .limit(RECENT_LAST_SEEN_LIMIT);

  if (error) {
    console.error('[AdminUserAnalytics] last seen query failed', error);
    return [];
  }

  const ids = (data ?? []).map((r) => r.user_id as string);
  const accounts = await fetchAccountsByIds(ids);

  return (data ?? []).map((r) => {
    const acc = accounts.get(r.user_id as string);
    return {
      id: r.user_id as string,
      email: acc?.email ?? null,
      name: acc?.name ?? null,
      lastSeenAt: r.last_seen_at as string,
      totalActiveMinutes: r.total_active_minutes as number,
    };
  });
}

async function loadTopByActiveTime() {
  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('user_presence')
    .select('user_id, total_active_minutes, last_seen_at')
    .order('total_active_minutes', { ascending: false })
    .limit(TOP_TIME_LIMIT);

  if (error) {
    console.error('[AdminUserAnalytics] top time query failed', error);
    return [];
  }

  const ids = (data ?? []).map((r) => r.user_id as string);
  const accounts = await fetchAccountsByIds(ids);

  return (data ?? []).map((r) => {
    const acc = accounts.get(r.user_id as string);
    return {
      id: r.user_id as string,
      email: acc?.email ?? null,
      name: acc?.name ?? null,
      lastSeenAt: r.last_seen_at as string,
      totalActiveMinutes: r.total_active_minutes as number,
    };
  });
}

async function loadNewestAccounts() {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('id, email, name, created_at')
    .order('created_at', { ascending: false })
    .limit(NEWEST_ACCOUNTS_LIMIT);

  if (error) {
    console.error('[AdminUserAnalytics] newest accounts query failed', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string | null,
    name: r.name as string | null,
    createdAt: r.created_at as string | null,
  }));
}

async function loadStreakLeaders() {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('user_streaks')
    .select('user_id, longest_streak_days, current_streak_days')
    .order('longest_streak_days', { ascending: false })
    .order('current_streak_days', { ascending: false })
    .limit(STREAK_LEADERS_LIMIT);

  if (error) {
    console.error('[AdminUserAnalytics] streak leaders query failed', error);
    return [];
  }

  const ids = (data ?? []).map((r) => r.user_id as string);
  const accounts = await fetchAccountsByIds(ids);

  return (data ?? []).map((r) => {
    const acc = accounts.get(r.user_id as string);
    return {
      id: r.user_id as string,
      email: acc?.email ?? null,
      name: acc?.name ?? null,
      longestStreakDays: r.longest_streak_days as number,
      currentStreakDays: r.current_streak_days as number,
    };
  });
}

type RpcUploadRow = { user_id: string; upload_count: number | string };

async function loadTopUploaders() {
  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('admin_top_artwork_uploaders', {
    p_limit: TOP_UPLOADERS_LIMIT,
  });

  if (error) {
    console.error('[AdminUserAnalytics] top uploaders rpc failed', error);
    return [];
  }

  const rows = (data ?? []) as RpcUploadRow[];
  const ids = rows.map((r) => r.user_id);
  const accounts = await fetchAccountsByIds(ids);

  return rows.map((r) => {
    const acc = accounts.get(r.user_id);
    return {
      id: r.user_id,
      email: acc?.email ?? null,
      name: acc?.name ?? null,
      uploadCount: Number(r.upload_count),
    };
  });
}

function Avatar({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#1793d1]/30 bg-[#1793d1]/10 font-mono text-xs font-semibold text-[#67d4ff]"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export async function AdminUserAnalytics() {
  const [recentSignIns, online, topByTime, newestAccounts, lastSeen, streakLeaders, topUploaders] =
    await Promise.all([
      loadRecentSignIns(),
      loadOnlineNow(),
      loadTopByActiveTime(),
      loadNewestAccounts(),
      loadRecentByLastSeen(),
      loadStreakLeaders(),
      loadTopUploaders(),
    ]);

  console.log('[AdminUserAnalytics] loaded user activity panels', {
    recentSignIns: recentSignIns.length,
    onlineTotal: online.total,
    topByTime: topByTime.length,
    newestAccounts: newestAccounts.length,
    lastSeen: lastSeen.length,
    streakLeaders: streakLeaders.length,
    topUploaders: topUploaders.length,
  });

  return (
    <section>
      <p className={`${adminMonoLabel} mb-3`}>user_activity</p>
      <Card className={adminPanel}>
        <CardHeader className="border-b border-[#1793d1]/15 pb-4">
          <CardTitle className="font-mono text-lg text-[#67d4ff]">
            presence & engagement
          </CardTitle>
          <CardDescription className="font-mono text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-400">Top row:</strong> online users (heartbeat), most time on
            app, newest accounts by registration, recent sign-ins. Heartbeat requires{' '}
            <code className="text-[#67d4ff]/80">user_presence</code> migration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Online now */}
            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <Activity className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  online_now
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  last {ONLINE_WINDOW_MINUTES}m — visible tab + heartbeat
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-semibold tabular-nums text-slate-100">
                  {online.total.toLocaleString()}
                </p>
                {online.rows.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {online.rows.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                          <span className="absolute inset-0 animate-ping rounded-full bg-[#1793d1]/50" />
                          <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-[#1793d1]" />
                        </span>
                        <span className="truncate font-mono text-[13px] text-slate-300">
                          {bestLabel(u)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                          {formatRelative(u.lastSeenAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Most time on app */}
            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <Clock className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  most_time_on_app
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  top {TOP_TIME_LIMIT} by total_active_minutes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topByTime.length === 0 ? (
                  <p className="font-mono text-[13px] text-slate-500">
                    no presence rows — run migration & browse signed-in.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {topByTime.map((u, idx) => (
                      <li
                        key={u.id}
                        className={cn(
                          'flex items-center gap-2 rounded-sm px-1.5 py-1',
                          idx === 0 && 'bg-[#1793d1]/10',
                        )}
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-500">
                          {idx + 1}
                        </span>
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {bestLabel(u)}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[13px] tabular-nums text-[#67d4ff]">
                          {formatHoursMinutes(u.totalActiveMinutes)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* Newest accounts */}
            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <UserPlus className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  newest_accounts
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  by accounts.created_at — {NEWEST_ACCOUNTS_LIMIT} latest
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newestAccounts.length === 0 ? (
                  <p className="font-mono text-[13px] text-slate-500">no accounts.</p>
                ) : (
                  <ul className="space-y-2">
                    {newestAccounts.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {bestLabel(u)}
                          </p>
                          {u.email && u.name && (
                            <p className="truncate font-mono text-[11px] text-slate-500">{u.email}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-[11px] tabular-nums text-slate-400">
                            {formatAccountCreated(u.createdAt)}
                          </p>
                          <p className="font-mono text-[10px] text-slate-600">
                            {formatRelative(u.createdAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Recent sign-ins */}
            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <LogIn className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  recent_sign_ins
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  auth last_sign_in_at — {RECENT_SIGN_IN_LIMIT} from first page
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentSignIns.length === 0 ? (
                  <p className="font-mono text-[13px] text-slate-500">no data.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentSignIns.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {u.name || u.email || u.id.slice(0, 8)}
                          </p>
                          {u.name && u.email && (
                            <p className="truncate font-mono text-[11px] text-slate-500">
                              {u.email}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500">
                          {formatRelative(u.lastSignInAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <MousePointerClick className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  last_active_heartbeat
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  up to {RECENT_LAST_SEEN_LIMIT} — any last_seen_at
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lastSeen.length === 0 ? (
                  <p className="font-mono text-[13px] text-slate-500">
                    no rows — migrate user_presence.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lastSeen.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {bestLabel(u)}
                          </p>
                          {u.email && u.name && (
                            <p className="truncate font-mono text-[11px] text-slate-500">
                              {u.email}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500">
                          {formatRelative(u.lastSeenAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <Flame className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  longest_streaks
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  top {STREAK_LEADERS_LIMIT} — tie-break current
                </CardDescription>
              </CardHeader>
              <CardContent>
                {streakLeaders.length === 0 ? (
                  <p className="font-mono text-[13px] text-slate-500">no streak rows.</p>
                ) : (
                  <ol className="space-y-2">
                    {streakLeaders.map((u, idx) => (
                      <li
                        key={u.id}
                        className={cn(
                          'flex items-center gap-2 rounded-sm px-1.5 py-1',
                          idx === 0 && 'bg-[#1793d1]/10',
                        )}
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[11px] text-slate-500">
                          {idx + 1}
                        </span>
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {bestLabel(u)}
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500">
                            current {u.currentStreakDays}d
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[13px] text-[#67d4ff]">
                          {u.longestStreakDays}d best
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card className={adminPanelInner}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-mono text-sm font-medium text-[#67d4ff]">
                  <Upload className="h-4 w-4 text-[#1793d1]" aria-hidden />
                  most_artwork_posts
                </CardTitle>
                <CardDescription className="font-mono text-[11px] text-slate-500">
                  by <code className="text-[#67d4ff]/70">created_by</code> — rpc top {TOP_UPLOADERS_LIMIT}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topUploaders.length === 0 ? (
                  <p className="font-mono text-[12px] leading-relaxed text-slate-500">
                    no rpc data — run{' '}
                    <code className="text-[#67d4ff]/80">20260512000001_admin_top_artwork_uploaders</code>
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {topUploaders.map((u, idx) => (
                      <li
                        key={u.id}
                        className={cn(
                          'flex items-center gap-2 rounded-sm px-1.5 py-1',
                          idx === 0 && 'bg-[#1793d1]/10',
                        )}
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[11px] text-slate-500">
                          {idx + 1}
                        </span>
                        <Avatar label={bestLabel(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] text-slate-200">
                            {bestLabel(u)}
                          </p>
                          {u.email && u.name && (
                            <p className="truncate font-mono text-[11px] text-slate-500">
                              {u.email}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[13px] tabular-nums text-[#67d4ff]">
                          {u.uploadCount.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
