import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { adminPanel, adminMonoLabel } from './admin-dash-tokens';

type FunnelRow = {
  label: string;
  value: number | null;
  conversionFrom?: { label: string; rate: number | null };
};

function pct(num: number | null, den: number | null): number | null {
  if (!num || !den) return null;
  return Math.round((num / den) * 100);
}

function FunnelBar({
  label,
  value,
  total,
  conversionPct,
}: {
  label: string;
  value: number | null;
  total: number | null;
  conversionPct?: number | null;
}) {
  const barWidth = total && value ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-400">{label}</span>
        <div className="flex items-center gap-3">
          {conversionPct != null && (
            <span className="font-mono text-[11px] text-[#1793d1]/70">
              {conversionPct}% from prev
            </span>
          )}
          <span className="font-mono text-sm tabular-nums text-slate-100">
            {value === null ? '—' : value.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#1793d1]/10">
        <div
          className="h-1.5 rounded-full bg-[#1793d1]/60 transition-all"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

async function fetchFunnelData(since: string) {
  const admin = getSupabaseServerAdminClient();

  // Step 1: accounts created since `since`
  const { data: accounts, error: accErr } = await admin
    .from('accounts')
    .select('id, public_data')
    .gte('created_at', since);

  if (accErr) {
    console.error('[AdminFunnel] accounts query failed', accErr);
    return null;
  }

  const signups = accounts?.length ?? 0;

  // Step 2: of those, how many completed onboarding (have a role)
  const withRole = (accounts ?? []).filter(
    (a) => a.public_data && (a.public_data as Record<string, unknown>).role,
  ).length;

  if (signups === 0) {
    return { signups, withRole, withArtwork: 0 };
  }

  // Step 3: of those, how many uploaded at least one artwork
  const accountIds = (accounts ?? []).map((a) => a.id);

  const { data: artworkRows, error: artErr } = await asUntyped(admin)
    .from('artworks')
    .select('account_id')
    .in('account_id', accountIds);

  if (artErr) {
    console.error('[AdminFunnel] artworks query failed', artErr);
    return { signups, withRole, withArtwork: null };
  }

  const artistsWithArtwork = new Set((artworkRows ?? []).map((r: Record<string, unknown>) => r.account_id)).size;

  return { signups, withRole, withArtwork: artistsWithArtwork };
}

export async function AdminFunnelAnalytics() {
  const now = new Date();

  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log('[AdminFunnel] fetching 7-day and 30-day funnel data');

  const [funnel7, funnel30] = await Promise.all([
    fetchFunnelData(since7),
    fetchFunnelData(since30),
  ]);

  console.log('[AdminFunnel] loaded', { funnel7, funnel30 });

  function renderFunnel(
    data: { signups: number; withRole: number; withArtwork: number | null } | null,
    window: string,
  ) {
    if (!data) {
      return (
        <p className="font-mono text-xs text-slate-500">
          Failed to load — check server logs for [AdminFunnel].
        </p>
      );
    }

    const rows: FunnelRow[] = [
      { label: 'signups', value: data.signups },
      {
        label: 'onboarding_complete (role set)',
        value: data.withRole,
        conversionFrom: { label: 'signups', rate: pct(data.withRole, data.signups) },
      },
      {
        label: 'first_artwork_uploaded',
        value: data.withArtwork,
        conversionFrom: { label: 'onboarding_complete', rate: pct(data.withArtwork, data.withRole) },
      },
    ];

    return (
      <div className="space-y-4">
        <p className={`${adminMonoLabel}`}>{window}</p>
        {rows.map((r) => (
          <FunnelBar
            key={r.label}
            label={r.label}
            value={r.value}
            total={data.signups}
            conversionPct={r.conversionFrom?.rate}
          />
        ))}
      </div>
    );
  }

  return (
    <section>
      <p className={`${adminMonoLabel} mb-3`}>ad_funnel</p>
      <Card className={adminPanel}>
        <CardHeader className="border-b border-[#1793d1]/15 pb-4">
          <CardTitle className="font-mono text-lg text-[#67d4ff]">acquisition funnel</CardTitle>
          <CardDescription className="font-mono text-xs text-slate-500">
            signups → onboarding complete → first artwork. Conversion rates between steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-8 md:grid-cols-2">
            {renderFunnel(funnel7, 'last_7_days')}
            {renderFunnel(funnel30, 'last_30_days')}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
