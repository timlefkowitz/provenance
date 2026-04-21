import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

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
    <Card className="border-wine/15 bg-parchment/40">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg text-wine">{title}</CardTitle>
        <CardDescription className="font-serif text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-bold tabular-nums text-ink">
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
    fetchCount('subscriptions_active', async () => {
      const { count, error } = await admin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
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
    <Card className="border-wine/25">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-wine">Analytics</CardTitle>
        <CardDescription className="font-serif">
          Snapshot of users, artworks, and subscriptions across the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total users"
            value={totalUsers}
            description="Accounts in the database"
          />
          <StatCard
            title="Total artworks"
            value={totalArtworks}
            description="All certificate records"
          />
          <StatCard
            title="Verified artworks"
            value={verifiedArtworks}
            description="Published / verified status"
          />
          <StatCard
            title="Artist & gallery profiles"
            value={artistGalleryProfiles}
            description="Role profiles (excludes collector)"
          />
          <StatCard
            title="Active subscriptions"
            value={activeSubscriptions}
            description="Stripe subscription status active"
          />
          <StatCard
            title="New users this month"
            value={newUsersThisMonth}
            description="Accounts created since month start (UTC)"
          />
        </div>
      </CardContent>
    </Card>
  );
}
