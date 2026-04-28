import {
  Activity,
  Clock,
  Flame,
  LogIn,
  MousePointerClick,
  Upload,
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

const ONLINE_WINDOW_MINUTES = 5;
const RECENT_SIGN_IN_LIMIT = 12;
const TOP_TIME_LIMIT = 12;
const RECENT_LAST_SEEN_LIMIT = 20;
const STREAK_LEADERS_LIMIT = 8;
const TOP_UPLOADERS_LIMIT = 8;

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

  // user_presence + admin_top_artwork_uploaders: see makerkit migrations 20260512*
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine/15 font-display text-sm font-semibold text-wine"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export async function AdminUserAnalytics() {
  const [recentSignIns, online, topByTime, lastSeen, streakLeaders, topUploaders] =
    await Promise.all([
      loadRecentSignIns(),
      loadOnlineNow(),
      loadTopByActiveTime(),
      loadRecentByLastSeen(),
      loadStreakLeaders(),
      loadTopUploaders(),
    ]);

  console.log('[AdminUserAnalytics] loaded user activity panels', {
    recentSignIns: recentSignIns.length,
    onlineTotal: online.total,
    topByTime: topByTime.length,
    lastSeen: lastSeen.length,
    streakLeaders: streakLeaders.length,
    topUploaders: topUploaders.length,
  });

  return (
    <Card className="border-wine/25">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-wine">
          User activity
        </CardTitle>
        <CardDescription className="font-serif">
          Sign-ins, real-time presence, time on site (heartbeat), streaks, and uploads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Online now */}
          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <Activity className="h-4 w-4" aria-hidden />
                Online now
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                Active in the last {ONLINE_WINDOW_MINUTES} minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold tabular-nums text-ink">
                {online.total.toLocaleString()}
              </p>
              {online.rows.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {online.rows.map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <span
                        className="relative flex h-2.5 w-2.5 shrink-0"
                        aria-hidden
                      >
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
                        <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="truncate font-serif text-sm text-ink">
                        {bestLabel(u)}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-xs text-ink/60">
                        {formatRelative(u.lastSeenAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent sign-ins */}
          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <LogIn className="h-4 w-4" aria-hidden />
                Recent sign-ins
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                Last {RECENT_SIGN_IN_LIMIT} accounts to authenticate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSignIns.length === 0 ? (
                <p className="font-serif text-sm text-ink/60">No data yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentSignIns.map((u) => (
                    <li key={u.id} className="flex items-center gap-3">
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-ink">
                          {u.name || u.email || u.id.slice(0, 8)}
                        </p>
                        {u.name && u.email && (
                          <p className="truncate font-mono text-xs text-ink/55">
                            {u.email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-ink/60">
                        {formatRelative(u.lastSignInAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top by active time */}
          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <Clock className="h-4 w-4" aria-hidden />
                Most time invested
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                Top {TOP_TIME_LIMIT} by active minutes (heartbeat-derived)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topByTime.length === 0 ? (
                <p className="font-serif text-sm text-ink/60">
                  No presence data yet — heartbeats accrue as users browse.
                </p>
              ) : (
                <ol className="space-y-2">
                  {topByTime.map((u, idx) => (
                    <li
                      key={u.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1.5',
                        idx === 0 && 'bg-wine/5',
                      )}
                    >
                      <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-ink/55">
                        {idx + 1}
                      </span>
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-ink">
                          {bestLabel(u)}
                        </p>
                        <p className="truncate font-mono text-xs text-ink/55">
                          last seen {formatRelative(u.lastSeenAt)}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-sm tabular-nums text-wine">
                        {formatHoursMinutes(u.totalActiveMinutes)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Last active (heartbeat) */}
          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <MousePointerClick className="h-4 w-4" aria-hidden />
                Last active in app
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                By most recent heartbeat — up to {RECENT_LAST_SEEN_LIMIT} users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastSeen.length === 0 ? (
                <p className="font-serif text-sm text-ink/60">
                  No presence rows yet — run DB migration for user_presence if missing.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lastSeen.map((u) => (
                    <li key={u.id} className="flex items-center gap-3">
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-ink">
                          {bestLabel(u)}
                        </p>
                        {u.email && u.name && (
                          <p className="truncate font-mono text-xs text-ink/55">
                            {u.email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-ink/60">
                        {formatRelative(u.lastSeenAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <Flame className="h-4 w-4" aria-hidden />
                Longest streaks
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                Top {STREAK_LEADERS_LIMIT} by longest streak (tie-break: current)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {streakLeaders.length === 0 ? (
                <p className="font-serif text-sm text-ink/60">No streak data yet.</p>
              ) : (
                <ol className="space-y-2">
                  {streakLeaders.map((u, idx) => (
                    <li
                      key={u.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1.5',
                        idx === 0 && 'bg-wine/5',
                      )}
                    >
                      <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-ink/55">
                        {idx + 1}
                      </span>
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-ink">
                          {bestLabel(u)}
                        </p>
                        <p className="truncate font-mono text-xs text-ink/55">
                          current {u.currentStreakDays}d
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-sm tabular-nums text-wine">
                        {u.longestStreakDays}d best
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="border-wine/15 bg-parchment/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base text-wine">
                <Upload className="h-4 w-4" aria-hidden />
                Most artwork posts
              </CardTitle>
              <CardDescription className="font-serif text-xs">
                Top {TOP_UPLOADERS_LIMIT} by count of artworks with{' '}
                <code className="text-[10px]">created_by</code> (posters)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topUploaders.length === 0 ? (
                <p className="font-serif text-sm text-ink/60">
                  No data — apply migration{' '}
                  <code className="text-[10px]">20260512000001_admin_top_artwork_uploaders</code>{' '}
                  or add artworks with created_by set.
                </p>
              ) : (
                <ol className="space-y-2">
                  {topUploaders.map((u, idx) => (
                    <li
                      key={u.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1.5',
                        idx === 0 && 'bg-wine/5',
                      )}
                    >
                      <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-ink/55">
                        {idx + 1}
                      </span>
                      <Avatar label={bestLabel(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-ink">
                          {bestLabel(u)}
                        </p>
                        {u.email && u.name && (
                          <p className="truncate font-mono text-xs text-ink/55">
                            {u.email}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-display text-sm tabular-nums text-wine">
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
  );
}
