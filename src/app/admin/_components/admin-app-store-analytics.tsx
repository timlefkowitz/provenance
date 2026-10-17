import { Smartphone } from 'lucide-react';
import { getAscConfig, loadDownloadsOverview } from '~/lib/apple/app-store-connect';
import { adminMonoLabel, adminPanelInner } from './admin-dash-tokens';

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtMonth(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className={`${adminPanelInner} px-4 py-3`}>
      <p className={adminMonoLabel}>{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-100">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function Bars({
  series,
  label,
}: {
  series: { key: string; label: string; value: number }[];
  label: string;
}) {
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="flex h-20 items-end gap-0.5" aria-label={label}>
      {series.map((s) => (
        <div
          key={s.key}
          title={`${s.label}: ${s.value}`}
          className="group relative flex-1 cursor-default"
          style={{ height: 80 }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[1px] bg-[#1793d1]/50 transition-all group-hover:bg-[#1793d1]/90"
            style={{ height: Math.max(2, Math.round((s.value / max) * 80)) }}
          />
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="admin-app-store-heading">
      <div className="mb-3 space-y-1">
        <h2
          id="admin-app-store-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-100 sm:text-xl"
        >
          <Smartphone className="h-4 w-4 text-[#1793d1]" />
          App Store downloads
        </h2>
        <p className={`${adminMonoLabel} !normal-case !tracking-normal text-slate-500`}>
          iOS app · App Store Connect sales reports · refreshed every 6h, about a day behind
        </p>
      </div>
      {children}
    </section>
  );
}

export function AdminAppStoreAnalyticsFallback() {
  return (
    <Shell>
      <div className={`${adminPanelInner} px-4 py-6`}>
        <p className="font-mono text-[12px] text-slate-500">Loading App Store reports…</p>
      </div>
    </Shell>
  );
}

export async function AdminAppStoreAnalytics() {
  if (!getAscConfig()) {
    return (
      <Shell>
        <div className="rounded-sm border border-[#1793d1]/25 bg-[#12151c] px-4 py-3">
          <p className="font-mono text-[12px] text-slate-400">
            Not configured. Create a Team Key with the Sales role in App Store Connect → Users and
            Access → Integrations, then set{' '}
            <code className="text-[#67d4ff]/80">ASC_ISSUER_ID</code>,{' '}
            <code className="text-[#67d4ff]/80">ASC_KEY_ID</code>,{' '}
            <code className="text-[#67d4ff]/80">ASC_PRIVATE_KEY</code> and{' '}
            <code className="text-[#67d4ff]/80">ASC_VENDOR_NUMBER</code>.
          </p>
        </div>
      </Shell>
    );
  }

  try {
    const overview = await loadDownloadsOverview(30, 12);
    const { last30, daily, monthly } = overview;
    const last7 = daily.slice(-7).reduce((s, d) => s + d.downloads, 0);
    const countries = Object.entries(last30.countries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
    const maxCountry = countries[0]?.[1] ?? 1;

    return (
      <Shell>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="downloads · 7d" value={last7} hint="first-time installs" />
            <Stat label="downloads · 30d" value={last30.downloads} hint="first-time installs" />
            <Stat
              label="downloads · 12 mo"
              value={overview.totalMonthly}
              hint="last 12 full months"
            />
            <Stat
              label="redownloads · 30d"
              value={last30.redownloads}
              hint={`${last30.updates.toLocaleString()} updates`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`${adminPanelInner} p-4 lg:col-span-2`}>
              <p className={`${adminMonoLabel} mb-3`}>daily downloads · 30d</p>
              <Bars
                label="daily downloads"
                series={daily.map((d) => ({ key: d.day, label: fmtDay(d.day), value: d.downloads }))}
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
                <span>{daily[0] ? fmtDay(daily[0].day) : ''}</span>
                <span>{daily.at(-1) ? fmtDay(daily.at(-1)!.day) : ''}</span>
              </div>

              <p className={`${adminMonoLabel} mb-3 mt-6`}>monthly downloads · 12 mo</p>
              <Bars
                label="monthly downloads"
                series={monthly.map((m) => ({
                  key: m.month,
                  label: fmtMonth(m.month),
                  value: m.downloads,
                }))}
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
                <span>{monthly[0] ? fmtMonth(monthly[0].month) : ''}</span>
                <span>{monthly.at(-1) ? fmtMonth(monthly.at(-1)!.month) : ''}</span>
              </div>
            </div>

            <div className={`${adminPanelInner} p-4`}>
              <p className={`${adminMonoLabel} mb-3`}>top countries · 30d</p>
              {countries.length === 0 ? (
                <p className="font-mono text-[12px] text-slate-500">No downloads in this window.</p>
              ) : (
                <div className="space-y-2">
                  {countries.map(([code, n]) => (
                    <div key={code} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] text-slate-300">{code}</span>
                        <span className="font-mono text-[12px] tabular-nums text-[#67d4ff]">
                          {n.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#1793d1]/10">
                        <div
                          className="h-1.5 rounded-full bg-[#1793d1]/60"
                          style={{ width: `${Math.round((n / maxCountry) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Shell>
    );
  } catch (err) {
    console.error('[AdminAppStoreAnalytics] failed', err);
    return (
      <Shell>
        <div className="rounded-sm border border-red-500/30 bg-[#12151c] px-4 py-3">
          <p className="font-mono text-[12px] text-red-300">
            App Store Connect request failed: {err instanceof Error ? err.message : String(err)}
          </p>
        </div>
      </Shell>
    );
  }
}
