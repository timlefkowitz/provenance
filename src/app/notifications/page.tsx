import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import { NotificationsList } from './_components/notifications-list';
import { markAllNotificationsAsRead } from '~/lib/notifications';

export const metadata = {
  title: 'Notifications | Provenance',
};

export default async function NotificationsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Fetch notifications
  const { data: notifications, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching notifications:', error);
    // Return empty array instead of crashing
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
              await markAllNotificationsAsRead(user.id);
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
        userId={user.id}
      />
    </div>
  );
}

