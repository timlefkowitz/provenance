import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { adminPanel, adminMonoLabel } from './admin-dash-tokens';

async function fetchCount(
  label: string,
  fn: () => Promise<{ count: number | null; error: Error | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await fn();
    if (error) {
      console.error(`[AdminAnalytics] ${label} count failed`, error);
      return null;
    }
    return count ?? 0;
  } catch (err) {
    console.error(`[AdminAnalytics] ${label} count threw`, err);
    return null;
  }
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | null;
  description: string;
}) {
  return (
    <Card className={adminPanel}>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-sm font-medium text-[#67d4ff]">{title}</CardTitle>
        <CardDescription className="font-mono text-[11px] leading-snug text-slate-500">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold tabular-nums text-slate-100">
          {value === null ? '—' : value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

export async function AdminAnalytics() {
  const admin = getSupabaseServerAdminClient();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();
  const nowIso = new Date().toISOString();

  const [
    totalUsers,
    totalArtworks,
    verifiedArtworks,
    artistGalleryProfiles,
    activeSubscriptions,
    newUsersThisMonth,
  ] = await Promise.all([
    fetchCount('accounts', async () => {
      const { count, error } = await admin
        .from('accounts')
        .select('*', { count: 'exact', head: true });
      return { count, error: error as Error | null };
    }),
    fetchCount('artworks', async () => {
      const { count, error } = await admin
        .from('artworks')
        .select('*', { count: 'exact', head: true });
      return { count, error: error as Error | null };
    }),
    fetchCount('artworks_verified', async () => {
      const { count, error } = await admin
        .from('artworks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'verified');
      return { count, error: error as Error | null };
    }),
    fetchCount('user_profiles_artist_gallery', async () => {
      const { count, error } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['artist', 'gallery']);
      return { count, error: error as Error | null };
    }),
    fetchCount('subscriptions_active_or_trial', async () => {
      const { count, error } = await admin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trialing'])
        .or(`current_period_end.is.null,current_period_end.gte.${nowIso}`);
      return { count, error: error as Error | null };
    }),
    fetchCount('accounts_new_month', async () => {
      const { count, error } = await admin
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startIso);
      return { count, error: error as Error | null };
    }),
  ]);

  console.log('[AdminAnalytics] loaded snapshot');

  return (
    <section>
      <p className={`${adminMonoLabel} mb-3`}>platform_metrics</p>
      <Card className={adminPanel}>
        <CardHeader className="border-b border-[#1793d1]/15 pb-4">
          <CardTitle className="font-mono text-lg text-[#67d4ff]">aggregate counts</CardTitle>
          <CardDescription className="font-mono text-xs text-slate-500">
            Snapshot of users, artworks, and subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="total_users"
              value={totalUsers}
              description="accounts table"
            />
            <StatCard
              title="total_artworks"
              value={totalArtworks}
              description="all certificate rows"
            />
            <StatCard
              title="verified_artworks"
              value={verifiedArtworks}
              description="status = verified"
            />
            <StatCard
              title="artist_gallery_profiles"
              value={artistGalleryProfiles}
              description="role profiles"
            />
            <StatCard
              title="active_trial_subs"
              value={activeSubscriptions}
              description="subscriptions active or trialing"
            />
            <StatCard
              title="new_users_month_utc"
              value={newUsersThisMonth}
              description="accounts since month start"
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
