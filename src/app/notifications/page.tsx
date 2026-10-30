import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import { NotificationsList } from './_components/notifications-list';
import { markAllNotificationsAsRead } from './_actions/manage-notifications';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Notifications | Provenance',
};

type NotificationRow = { metadata: Record<string, unknown> | null };

/**
 * Exhibition notifications sent before open_call_slug was stored (invites,
 * submissions) only carry exhibition_id. Look the open call up so every
 * exhibition notification can link to its open call page.
 */
async function withOpenCallSlugs<T extends NotificationRow>(rows: T[]): Promise<T[]> {
  const missing = new Set<string>();
  for (const row of rows) {
    const exhibitionId = row.metadata?.exhibition_id;
    if (typeof exhibitionId === 'string' && typeof row.metadata?.open_call_slug !== 'string') {
      missing.add(exhibitionId);
    }
  }
  if (!missing.size) return rows;

  // Admin client: open calls are public even while their exhibition is a
  // private draft (same as getOpenCallBySlug); only the slug is read.
  const { data, error } = await asUntyped(getSupabaseServerAdminClient())
    .from('open_calls')
    .select('exhibition_id, slug')
    .in('exhibition_id', [...missing]);
  if (error) {
    console.error('Error loading open calls for notifications:', error);
    return rows;
  }

  const slugByExhibition = new Map(
    ((data ?? []) as Array<{ exhibition_id: string; slug: string }>).map((o) => [o.exhibition_id, o.slug]),
  );
  return rows.map((row) => {
    const slug = slugByExhibition.get(row.metadata?.exhibition_id as string);
    return slug && typeof row.metadata?.open_call_slug !== 'string'
      ? { ...row, metadata: { ...row.metadata, open_call_slug: slug } }
      : row;
  });
}

export default async function NotificationsPage() {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Fetch notifications with error handling
  let notifications = [];
  try {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching notifications:', error);
      notifications = [];
    } else {
      notifications = await withOpenCallSlugs(data || []);
    }
  } catch (err) {
    console.error('Unexpected error fetching notifications:', err);
    notifications = [];
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-wine mb-2">
              Notifications
            </h1>
            <p className="text-ink/70 font-serif">
              Your messages and alerts
            </p>
          </div>
          {notifications && notifications.length > 0 && (
            <form action={async () => {
              'use server';
              await markAllNotificationsAsRead();
            }}>
              <button
                type="submit"
                className="text-sm text-wine hover:text-wine/80 font-serif underline"
              >
                Mark all as read
              </button>
            </form>
          )}
        </div>
      </div>

      <NotificationsList 
        notifications={notifications || []}
      />
    </div>
  );
}

