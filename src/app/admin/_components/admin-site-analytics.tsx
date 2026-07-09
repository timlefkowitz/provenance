import {
  BarChart2,
  Clock,
  Map as MapIcon,
  Monitor,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { adminMonoLabel, adminPanelInner } from './admin-dash-tokens';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type DauRow = { day: string; active_users: number };
type PageRow = { path: string; total_active_minutes: number; view_count: number; last_seen_at: string };
type SessionStats = {
  total_sessions: number;
  distinct_users: number;
  avg_session_minutes: number;
  median_session_minutes: number;
  p90_session_minutes: number;
};
type DeviceRow = { device: string; browser: string; cnt: number };
type RetentionRow = {
  week_start: string;
  new_users: number;
  returning_users: number;
  retention_pct: number;
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMinutes(m: number | null | undefined): string {
  if (!m || m < 1) return '0m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

/** Horizontal bar with label + value, used for all distribution panels. */
function HBar({
  label,
  value,
  max,
  suffix = '',
  mono = true,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  mono?: boolean;
}) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`truncate ${mono ? 'font-mono' : ''} text-[12px] text-slate-300`}
          title={label}
        >
          {label}
        </span>
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#67d4ff]">
          {value.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#1793d1]/10">
        <div
          className="h-1.5 rounded-full bg-[#1793d1]/60 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Vertical sparkline-style bar chart for a date series. */
function SparkBars({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="flex h-16 items-end gap-0.5" aria-label="daily active users">
      {series.map((s) => {
        const h = Math.max(2, Math.round((s.value / max) * 64));
        return (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            className="group relative flex-1 cursor-default"
            style={{ height: 64 }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-[1px] bg-[#1793d1]/50 transition-all group-hover:bg-[#1793d1]/90"
              style={{ height: h }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Collapsible panel shell matching the admin dash aesthetic. */
function CollapsiblePanel({
  id,
  icon,
  title,
  description,
  defaultOpen = true,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary
        className={`
          flex cursor-pointer list-none select-none items-center justify-between
          rounded-sm border border-[#1793d1]/20 bg-[#0f1318] px-4 py-3
          hover:border-[#1793d1]/40 hover:bg-[#12151c]
          group-open:rounded-b-none group-open:border-[#1793d1]/30
        `}
        id={`${id}-summary`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[#1793d1]">{icon}</span>
          <span className="font-mono text-sm font-medium text-[#67d4ff]">{title}</span>
          <span className="font-mono text-[11px] text-slate-500 sm:block hidden">— {description}</span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="rounded-b-sm border border-t-0 border-[#1793d1]/20 bg-[#0f1318] p-4">
        {children}
      </div>
    </details>
  );
}

// -------------------------------------------------------------------------
// Data loaders
// -------------------------------------------------------------------------

async function loadDauSeries(days: number): Promise<DauRow[]> {
  try {
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.rpc('admin_dau_series', { p_days: days });
    if (error) {
      console.error('[AdminSiteAnalytics] admin_dau_series failed', error);
      return [];
    }
    return (data ?? []) as DauRow[];
  } catch (err) {
    console.error('[AdminSiteAnalytics] admin_dau_series threw', err);
    return [];
  }
}

async function loadTopPages(limit = 20): Promise<PageRow[]> {
  try {
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.rpc('admin_top_pages', { p_limit: limit });
    if (error) {
      console.error('[AdminSiteAnalytics] admin_top_pages failed', error);
      return [];
    }
    return (data ?? []) as PageRow[];
  } catch (err) {
    console.error('[AdminSiteAnalytics] admin_top_pages threw', err);
    return [];
  }
}

async function loadSessionStats(): Promise<SessionStats | null> {
  try {
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.rpc('admin_session_stats');
    if (error) {
      console.error('[AdminSiteAnalytics] admin_session_stats failed', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      total_sessions:         Number(row.total_sessions ?? 0),
      distinct_users:         Number(row.distinct_users ?? 0),
      avg_session_minutes:    Number(row.avg_session_minutes ?? 0),
      median_session_minutes: Number(row.median_session_minutes ?? 0),
      p90_session_minutes:    Number(row.p90_session_minutes ?? 0),
    };
  } catch (err) {
    console.error('[AdminSiteAnalytics] admin_session_stats threw', err);
    return null;
  }
}

async function loadDeviceBreakdown(): Promise<DeviceRow[]> {
  try {
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.rpc('admin_device_breakdown');
    if (error) {
      console.error('[AdminSiteAnalytics] admin_device_breakdown failed', error);
      return [];
    }
    return (data ?? []) as DeviceRow[];
  } catch (err) {
    console.error('[AdminSiteAnalytics] admin_device_breakdown threw', err);
    return [];
  }
}

async function loadRetention(): Promise<RetentionRow[]> {
  try {
    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await admin.rpc('admin_retention');
    if (error) {
      console.error('[AdminSiteAnalytics] admin_retention failed', error);
      return [];
    }
    return (data ?? []) as RetentionRow[];
  } catch (err) {
    console.error('[AdminSiteAnalytics] admin_retention threw', err);
    return [];
  }
}

/** Compute daily signup counts for the last N days from auth.admin.listUsers. */
async function loadSignupSeries(days: number): Promise<{ day: string; count: number }[]> {
  try {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (error) {
    console.error('[AdminSiteAnalytics] loadSignupSeries listUsers failed', error);
    return [];
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const byDay = new Map<string, number>();

  // Pre-fill all days with 0 so the sparkline is contiguous.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }

  for (const u of data?.users ?? []) {
    if (!u.created_at) continue;
    const d = new Date(u.created_at);
    if (d < cutoff) continue;
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
  } catch (err) {
    console.error('[AdminSiteAnalytics] loadSignupSeries threw', err);
    return [];
  }
}

// -------------------------------------------------------------------------
// Main component
// -------------------------------------------------------------------------

export async function AdminSiteAnalytics() {
  try {
    const DAU_DAYS = 30;
    const SIGNUP_DAYS = 30;

    const [dauSeries, topPages, sessionStats, deviceBreakdown, retention, signupSeries] =
      await Promise.all([
        loadDauSeries(DAU_DAYS),
        loadTopPages(20),
        loadSessionStats(),
        loadDeviceBreakdown(),
        loadRetention(),
        loadSignupSeries(SIGNUP_DAYS),
      ]);

    // Derived metrics
    const dau = dauSeries.length > 0 ? dauSeries[dauSeries.length - 1]?.active_users ?? 0 : 0;
    const dauAvg7 =
      dauSeries.length >= 7
        ? Math.round(
            dauSeries
              .slice(-7)
              .reduce((s, r) => s + Number(r.active_users), 0) / 7,
          )
        : null;

    // WAU = distinct users in last 7 days — approximate from DAU series (server can't
    // de-duplicate user_ids, so show max instead and note the approximation).
    const dauMax7 =
      dauSeries.length >= 7
        ? Math.max(...dauSeries.slice(-7).map((r) => Number(r.active_users)))
        : null;

    const totalSignups30 = signupSeries.reduce((s, r) => s + r.count, 0);

    // Device totals
    const deviceTotals = new Map<string, number>();
    for (const row of deviceBreakdown) {
      deviceTotals.set(row.device, (deviceTotals.get(row.device) ?? 0) + Number(row.cnt));
    }
    const browserTotals = new Map<string, number>();
    for (const row of deviceBreakdown) {
      browserTotals.set(row.browser, (browserTotals.get(row.browser) ?? 0) + Number(row.cnt));
    }
    const maxDeviceCnt  = Math.max(...Array.from(deviceTotals.values()), 1);
    const maxBrowserCnt = Math.max(...Array.from(browserTotals.values()), 1);
    const maxPageMinutes = topPages.length > 0 ? topPages[0]?.total_active_minutes ?? 1 : 1;
    const maxPageViews   = topPages.length > 0 ? Math.max(...topPages.map((p) => p.view_count), 1) : 1;
    const maxRetentionPct = 100;

    const hasPresenceData = dauSeries.length > 0 || topPages.length > 0;

    console.log('[AdminSiteAnalytics] loaded', {
      dauDays: dauSeries.length,
      topPages: topPages.length,
      sessionStats,
      deviceRows: deviceBreakdown.length,
      retentionWeeks: retention.length,
      signupDays: signupSeries.length,
    });

    return (
      <section aria-labelledby="admin-site-analytics-heading">
        <div className="mb-3 space-y-1">
          <h2
            id="admin-site-analytics-heading"
            className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl"
          >
            Site analytics
          </h2>
          <p className={`${adminMonoLabel} !normal-case !tracking-normal text-slate-500`}>
            dau · sessions · top_pages · signups · retention · devices — collapsible
          </p>
        </div>

        {!hasPresenceData && (
          <div className="mb-4 rounded-sm border border-[#1793d1]/25 bg-[#12151c] px-4 py-3">
            <p className="font-mono text-[12px] text-slate-400">
              No site analytics data yet — the new tables start filling as users visit the app.
              Migration{' '}
              <code className="text-[#67d4ff]/80">20260622000000_site_analytics</code> must be
              applied and at least one heartbeat must have fired with the updated client.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">

          {/* ── Active Users ────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="active-users"
            icon={<Users className="h-4 w-4" />}
            title="active_users"
            description="DAU sparkline · 7-day avg · peak WAU"
            defaultOpen
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Stat tiles */}
              <Card className={adminPanelInner}>
                <CardHeader className="pb-1">
                  <CardTitle className="font-mono text-xs text-slate-400">dau_yesterday</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-slate-100">
                    {dau.toLocaleString()}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">most recent day</p>
                </CardContent>
              </Card>

              <Card className={adminPanelInner}>
                <CardHeader className="pb-1">
                  <CardTitle className="font-mono text-xs text-slate-400">7d_avg_dau</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-slate-100">
                    {dauAvg7 !== null ? dauAvg7.toLocaleString() : '—'}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">rolling average</p>
                </CardContent>
              </Card>

              <Card className={adminPanelInner}>
                <CardHeader className="pb-1">
                  <CardTitle className="font-mono text-xs text-slate-400">peak_7d</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-slate-100">
                    {dauMax7 !== null ? dauMax7.toLocaleString() : '—'}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">max daily users (7d)</p>
                </CardContent>
              </Card>
            </div>

            {/* Sparkline */}
            {dauSeries.length > 0 && (
              <div className="mt-4">
                <p className={`${adminMonoLabel} mb-2`}>last_{DAU_DAYS}_days</p>
                <SparkBars
                  series={dauSeries.map((r) => ({
                    label: fmtDate(r.day),
                    value: Number(r.active_users),
                  }))}
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
                  <span>{fmtDate(dauSeries[0]?.day ?? '')}</span>
                  <span>{fmtDate(dauSeries[dauSeries.length - 1]?.day ?? '')}</span>
                </div>
              </div>
            )}
          </CollapsiblePanel>

          {/* ── Sessions ────────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="sessions"
            icon={<Clock className="h-4 w-4" />}
            title="sessions"
            description="avg length · total · per-user"
            defaultOpen
          >
            {!sessionStats || sessionStats.total_sessions === 0 ? (
              <p className="font-mono text-[12px] text-slate-500">
                no session data yet — will populate as users browse.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {(
                  [
                    { key: 'total_sessions',         label: 'total_sessions',         value: sessionStats.total_sessions.toLocaleString() },
                    { key: 'distinct_users',          label: 'tracked_users',          value: sessionStats.distinct_users.toLocaleString() },
                    { key: 'avg_session_minutes',     label: 'avg_session',            value: fmtMinutes(sessionStats.avg_session_minutes) },
                    { key: 'median_session_minutes',  label: 'median_session',         value: fmtMinutes(sessionStats.median_session_minutes) },
                    { key: 'p90_session_minutes',     label: 'p90_session',            value: fmtMinutes(sessionStats.p90_session_minutes) },
                  ] as { key: string; label: string; value: string }[]
                ).map(({ key, label, value }) => (
                  <Card key={key} className={adminPanelInner}>
                    <CardHeader className="pb-1">
                      <CardTitle className="font-mono text-xs text-slate-400">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-xl font-semibold tabular-nums text-[#67d4ff]">
                        {value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CollapsiblePanel>

          {/* ── Top Pages ───────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="top-pages"
            icon={<MapIcon className="h-4 w-4" />}
            title="top_pages"
            description="most time spent + most visited"
            defaultOpen
          >
            {topPages.length === 0 ? (
              <p className="font-mono text-[12px] text-slate-500">
                no page data yet — start browsing signed-in.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* By active time */}
                <div>
                  <p className={`${adminMonoLabel} mb-3`}>by_active_time</p>
                  <div className="space-y-3">
                    {topPages.slice(0, 10).map((p) => (
                      <HBar
                        key={p.path + '-time'}
                        label={p.path}
                        value={p.total_active_minutes}
                        max={maxPageMinutes}
                        suffix="m"
                      />
                    ))}
                  </div>
                </div>
                {/* By view count */}
                <div>
                  <p className={`${adminMonoLabel} mb-3`}>by_view_count</p>
                  <div className="space-y-3">
                    {[...topPages]
                      .sort((a, b) => b.view_count - a.view_count)
                      .slice(0, 10)
                      .map((p) => (
                        <HBar
                          key={p.path + '-views'}
                          label={p.path}
                          value={p.view_count}
                          max={maxPageViews}
                          suffix=" views"
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CollapsiblePanel>

          {/* ── New Signups ─────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="signups"
            icon={<TrendingUp className="h-4 w-4" />}
            title="new_signups"
            description={`${totalSignups30} in last ${SIGNUP_DAYS} days`}
            defaultOpen
          >
            <div className="flex items-start gap-8">
              <div>
                <p className="font-mono text-3xl font-semibold tabular-nums text-slate-100">
                  {totalSignups30.toLocaleString()}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  last {SIGNUP_DAYS} days
                </p>
              </div>
              {signupSeries.length > 0 && (
                <div className="flex-1">
                  <p className={`${adminMonoLabel} mb-2`}>daily_signups</p>
                  <SparkBars
                    series={signupSeries.map((r) => ({
                      label: r.day,
                      value: r.count,
                    }))}
                  />
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
                    <span>{fmtDate(signupSeries[0]?.day ?? '')}</span>
                    <span>{fmtDate(signupSeries[signupSeries.length - 1]?.day ?? '')}</span>
                  </div>
                </div>
              )}
            </div>
          </CollapsiblePanel>

          {/* ── Retention ───────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="retention"
            icon={<RefreshCw className="h-4 w-4" />}
            title="retention"
            description="weekly new vs returning — last 12 weeks"
            defaultOpen={false}
          >
            {retention.length === 0 ? (
              <p className="font-mono text-[12px] text-slate-500">
                no retention data yet — needs at least 2 weeks of activity.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-widest text-[#1793d1]/70 px-1">
                  <span>week</span>
                  <span className="text-right">new</span>
                  <span className="text-right">returning</span>
                  <span className="text-right">retention%</span>
                </div>
                {retention.map((r) => (
                  <div key={r.week_start} className="space-y-1">
                    <div className="grid grid-cols-4 gap-2 items-center px-1">
                      <span className="font-mono text-[12px] text-slate-400">{fmtDate(r.week_start)}</span>
                      <span className="font-mono text-[12px] tabular-nums text-right text-slate-300">
                        {Number(r.new_users).toLocaleString()}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums text-right text-slate-300">
                        {Number(r.returning_users).toLocaleString()}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums text-right text-[#67d4ff]">
                        {Number(r.retention_pct).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#1793d1]/10">
                      <div
                        className="h-1 rounded-full bg-[#1793d1]/50"
                        style={{ width: `${pct(Number(r.retention_pct), maxRetentionPct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsiblePanel>

          {/* ── Devices ─────────────────────────────────────────────────── */}
          <CollapsiblePanel
            id="devices"
            icon={<Monitor className="h-4 w-4" />}
            title="devices"
            description="device type + browser family"
            defaultOpen={false}
          >
            {deviceBreakdown.length === 0 ? (
              <p className="font-mono text-[12px] text-slate-500">
                no session data yet.
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className={`${adminMonoLabel} mb-3`}>by_device</p>
                  <div className="space-y-3">
                    {Array.from(deviceTotals.entries())
                      .sort(([, a], [, b]) => b - a)
                      .map(([device, cnt]) => (
                        <HBar key={device} label={device} value={cnt} max={maxDeviceCnt} />
                      ))}
                  </div>
                </div>
                <div>
                  <p className={`${adminMonoLabel} mb-3`}>by_browser</p>
                  <div className="space-y-3">
                    {Array.from(browserTotals.entries())
                      .sort(([, a], [, b]) => b - a)
                      .map(([browser, cnt]) => (
                        <HBar key={browser} label={browser} value={cnt} max={maxBrowserCnt} />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CollapsiblePanel>

          {/* ── Page Views Detail ────────────────────────────────────────── */}
          <CollapsiblePanel
            id="page-detail"
            icon={<BarChart2 className="h-4 w-4" />}
            title="page_detail"
            description="all tracked routes with time + views"
            defaultOpen={false}
          >
            {topPages.length === 0 ? (
              <p className="font-mono text-[12px] text-slate-500">no data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-[#1793d1]/15">
                      <th className="py-2 pr-4 text-left font-medium text-[#1793d1]/70">path</th>
                      <th className="py-2 pr-4 text-right font-medium text-[#1793d1]/70">active_time</th>
                      <th className="py-2 pr-4 text-right font-medium text-[#1793d1]/70">views</th>
                      <th className="py-2 text-right font-medium text-[#1793d1]/70">last_seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPages.map((p) => (
                      <tr key={p.path} className="border-b border-[#1793d1]/8 hover:bg-[#1793d1]/5">
                        <td className="py-1.5 pr-4 text-slate-300">{p.path}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-[#67d4ff]">
                          {fmtMinutes(p.total_active_minutes)}
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-slate-300">
                          {p.view_count.toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right text-slate-500">
                          {fmtDate(p.last_seen_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsiblePanel>

        </div>
      </section>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AdminSiteAnalytics] failed to render', err);
    return (
      <section
        aria-labelledby="admin-site-analytics-error"
        className="rounded-sm border border-red-500/40 bg-red-950/30 p-4"
      >
        <h2
          id="admin-site-analytics-error"
          className="font-mono text-sm font-medium text-red-300"
        >
          Site analytics failed to load
        </h2>
        <p className="mt-2 font-mono text-xs text-red-200/80">
          Check server logs for{' '}
          <span className="text-red-100">[AdminSiteAnalytics]</span>. Common causes: migration{' '}
          <code className="rounded bg-black/30 px-1">20260622000000_site_analytics</code> not
          applied, or missing{' '}
          <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
        {message && (
          <pre className="mt-3 overflow-x-auto rounded bg-black/40 px-3 py-2 font-mono text-[11px] text-red-200/70">
            {message}
          </pre>
        )}
      </section>
    );
  }
}
