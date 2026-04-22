'use client';

import { useMemo } from 'react';
import { LEAD_STAGES, STAGE_LABELS, STAGE_STYLES, type ArtistLead } from '../_actions/leads-constants';
import { TrendingUp, Users, Clock, Target } from 'lucide-react';

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

export function CrmAnalytics({ leads }: { leads: ArtistLead[] }) {
  const totalValue = useMemo(() => leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0), [leads]);
  const soldValue = useMemo(
    () => leads.filter((l) => l.stage === 'sold').reduce((s, l) => s + (l.estimated_value ?? 0), 0),
    [leads],
  );
  const conversion = totalValue > 0 && soldValue > 0 ? Math.round((soldValue / totalValue) * 100) : 0;
  const stale = useMemo(
    () => leads.filter((l) => daysSince(l.updated_at) >= 7).length,
    [leads],
  );
  const maxCount = useMemo(
    () => Math.max(1, ...LEAD_STAGES.map((s) => leads.filter((l) => l.stage === s).length)),
    [leads],
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-wine/12 bg-gradient-to-br from-parchment/90 to-parchment/40 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-wine/60 mb-2">
            <Users className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest font-serif font-semibold">Contacts</p>
          </div>
          <p className="text-3xl font-display font-bold text-ink">{leads.length}</p>
          <p className="text-xs text-ink/45 font-serif mt-1">People in your pipeline</p>
        </div>
        <div className="rounded-2xl border border-wine/12 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-wine/60 mb-2">
            <Target className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest font-serif font-semibold">Pipeline</p>
          </div>
          <p className="text-3xl font-display font-bold text-ink">{fmt(totalValue)}</p>
          <p className="text-xs text-ink/45 font-serif mt-1">Estimated value open</p>
        </div>
        <div className="rounded-2xl border border-wine/12 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-wine/60 mb-2">
            <TrendingUp className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest font-serif font-semibold">Closed</p>
          </div>
          <p className="text-3xl font-display font-bold text-emerald-800">{fmt(soldValue)}</p>
          <p className="text-xs text-ink/45 font-serif mt-1">Sold column total</p>
        </div>
        <div className="rounded-2xl border border-wine/12 bg-gradient-to-br from-parchment/80 to-amber-50/30 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-wine/60 mb-2">
            <Clock className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest font-serif font-semibold">Stale</p>
          </div>
          <p className="text-3xl font-display font-bold text-ink">{stale}</p>
          <p className="text-xs text-ink/45 font-serif mt-1">Not updated in 7+ days</p>
        </div>
      </div>

      {totalValue > 0 && soldValue > 0 && (
        <div className="rounded-2xl border border-wine/12 bg-parchment/50 px-6 py-4 flex flex-wrap items-baseline gap-2 font-serif text-sm text-ink/70">
          <span>Revenue share of pipeline from closed deals:</span>
          <span className="text-lg font-display font-bold text-ink tabular-nums">{conversion}%</span>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Stage distribution</h2>
        <div className="space-y-3">
          {LEAD_STAGES.map((stage) => {
            const n = leads.filter((l) => l.stage === stage).length;
            const pct = Math.round((n / maxCount) * 100);
            const styles = STAGE_STYLES[stage];
            return (
              <div key={stage}>
                <div className="flex items-center justify-between text-xs font-serif text-ink/60 mb-1">
                  <span className="font-medium text-ink">{STAGE_LABELS[stage]}</span>
                  <span className="tabular-nums">{n}</span>
                </div>
                <div className="h-2.5 rounded-full bg-wine/5 overflow-hidden border border-wine/8">
                  <div
                    className={`h-full rounded-full ${styles.dot} transition-all duration-500 ease-out`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
