'use client';

import { useMemo } from 'react';
import { LEAD_STAGES, STAGE_STYLES, type ArtistLead, type LeadStage } from '../_actions/leads-constants';
import { TrendingUp, Users, Clock, Target, ArrowRight } from 'lucide-react';

function fmt(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function daysSince(t: string) {
  return Math.floor((Date.now() - new Date(t).getTime()) / 86_400_000);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-wine/10 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-wine/6 text-wine/60">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] uppercase tracking-widest font-serif font-semibold text-ink/45">{label}</p>
      </div>
      <p className={`text-3xl font-display font-bold leading-none ${accent ?? 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-ink/40 font-serif">{sub}</p>}
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funnel({ leads, stageLabels }: { leads: ArtistLead[]; stageLabels: Record<LeadStage, string> }) {
  const counts = LEAD_STAGES.map((s) => leads.filter((l) => l.stage === s).length);
  const max = Math.max(1, ...counts);

  return (
    <div className="rounded-2xl border border-wine/10 bg-white p-6 shadow-sm">
      <h3 className="font-display font-semibold text-ink text-base mb-5">Pipeline funnel</h3>
      <div className="space-y-2">
        {LEAD_STAGES.map((stage, i) => {
          const n = counts[i];
          const pct = Math.round((n / max) * 100);
          const styles = STAGE_STYLES[stage];
          const dropOff = i > 0 && counts[i - 1] > 0
            ? Math.round(((counts[i - 1] - n) / counts[i - 1]) * 100)
            : null;

          return (
            <div key={stage} className="group">
              {dropOff !== null && (
                <div className="flex items-center gap-2 pl-3 pb-1">
                  <ArrowRight className="h-2.5 w-2.5 text-ink/20" />
                  <span className="text-[10px] font-serif text-ink/35">
                    {dropOff > 0 ? `${dropOff}% drop-off` : 'all progressed'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-xs font-serif font-medium text-ink/70 truncate">{stageLabels[stage]}</p>
                </div>
                <div className="flex-1 relative h-8 rounded-xl overflow-hidden bg-wine/4">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-xl ${styles.dot} opacity-80 transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center pl-3">
                    <span className="text-xs font-display font-bold text-white drop-shadow-sm">{n > 0 ? n : ''}</span>
                  </span>
                </div>
                <p className="w-8 shrink-0 text-right text-xs font-serif text-ink/40 tabular-nums">{n}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Value by stage ───────────────────────────────────────────────────────────

function ValueByStage({ leads, stageLabels }: { leads: ArtistLead[]; stageLabels: Record<LeadStage, string> }) {
  const entries = LEAD_STAGES.map((s) => ({
    stage: s,
    value: leads.filter((l) => l.stage === s).reduce((acc, l) => acc + (l.estimated_value ?? 0), 0),
  })).filter((e) => e.value > 0);

  if (!entries.length) return null;

  const maxVal = Math.max(...entries.map((e) => e.value));

  return (
    <div className="rounded-2xl border border-wine/10 bg-white p-6 shadow-sm">
      <h3 className="font-display font-semibold text-ink text-base mb-5">Value by stage</h3>
      <div className="space-y-3">
        {entries.map(({ stage, value }) => {
          const styles = STAGE_STYLES[stage];
          const pct = Math.round((value / maxVal) * 100);
          return (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="text-xs font-serif font-medium text-ink/70 truncate">{stageLabels[stage]}</p>
              </div>
              <div className="flex-1 h-2.5 rounded-full bg-wine/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${styles.dot} transition-all duration-700 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="w-20 shrink-0 text-right text-xs font-serif font-semibold text-ink/70 tabular-nums">{fmt(value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recency breakdown ────────────────────────────────────────────────────────

function RecencyBreakdown({ leads }: { leads: ArtistLead[] }) {
  const fresh   = leads.filter((l) => daysSince(l.updated_at) < 3).length;
  const aging   = leads.filter((l) => { const d = daysSince(l.updated_at); return d >= 3 && d < 7; }).length;
  const stale   = leads.filter((l) => { const d = daysSince(l.updated_at); return d >= 7 && d < 30; }).length;
  const cold    = leads.filter((l) => daysSince(l.updated_at) >= 30).length;

  const rows = [
    { label: 'Fresh',  sub: '< 3 days',  n: fresh, cls: 'bg-emerald-400' },
    { label: 'Active', sub: '3–6 days',  n: aging, cls: 'bg-amber-400' },
    { label: 'Stale',  sub: '1–4 weeks', n: stale, cls: 'bg-orange-400' },
    { label: 'Cold',   sub: '30+ days',  n: cold,  cls: 'bg-red-400' },
  ];

  const total = leads.length || 1;

  return (
    <div className="rounded-2xl border border-wine/10 bg-white p-6 shadow-sm">
      <h3 className="font-display font-semibold text-ink text-base mb-1">Contact activity</h3>
      <p className="text-xs font-serif text-ink/40 mb-5">How recently each lead was touched</p>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-5">
        {rows.map((r) => r.n > 0 && (
          <div
            key={r.label}
            className={`${r.cls} transition-all duration-700`}
            style={{ flex: r.n / total }}
            title={`${r.label}: ${r.n}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="text-center">
            <div className={`w-2.5 h-2.5 rounded-full ${r.cls} mx-auto mb-1.5`} />
            <p className="text-xl font-display font-bold text-ink">{r.n}</p>
            <p className="text-[10px] font-serif font-semibold text-ink/60 uppercase tracking-wide">{r.label}</p>
            <p className="text-[10px] font-serif text-ink/35">{r.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CrmAnalytics({
  leads,
  stageLabels,
}: {
  leads: ArtistLead[];
  stageLabels: Record<LeadStage, string>;
}) {
  const totalValue = useMemo(() => leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0), [leads]);
  const soldValue  = useMemo(
    () => leads.filter((l) => l.stage === 'sold').reduce((s, l) => s + (l.estimated_value ?? 0), 0),
    [leads],
  );
  const conversion = totalValue > 0 && soldValue > 0 ? Math.round((soldValue / totalValue) * 100) : null;
  const staleCount = useMemo(() => leads.filter((l) => daysSince(l.updated_at) >= 7).length, [leads]);

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-wine/20 bg-parchment/30 px-8 py-20 text-center">
        <p className="font-display text-lg font-semibold text-ink/40 mb-1">No data yet</p>
        <p className="font-serif text-sm text-ink/35">Add contacts on the CRM board to see analytics here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Contacts"   value={leads.length}       sub="People in your pipeline" />
        <StatCard icon={Target}     label="Pipeline"   value={fmt(totalValue)}    sub="Estimated open value" />
        <StatCard icon={TrendingUp} label="Closed"     value={fmt(soldValue)}     sub="Sold column total" accent="text-emerald-800" />
        <StatCard icon={Clock}      label="Stale"      value={staleCount}         sub="Not touched in 7+ days" accent={staleCount > 0 ? 'text-orange-700' : 'text-ink'} />
      </div>

      {conversion !== null && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-6 py-4 flex flex-wrap items-baseline gap-3 font-serif text-sm text-ink/70">
          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Pipeline conversion rate —</span>
          <span className="text-2xl font-display font-bold text-emerald-800 tabular-nums">{conversion}%</span>
          <span className="text-ink/45">of estimated value has been closed</span>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Funnel leads={leads} stageLabels={stageLabels} />
        <ValueByStage leads={leads} stageLabels={stageLabels} />
      </div>

      <RecencyBreakdown leads={leads} />
    </div>
  );
}
