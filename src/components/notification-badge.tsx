'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useUser } from '@kit/supabase/hooks/use-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function NotificationBadge() {
  const { data: user } = useUser();
  const client = useSupabase();

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications:unread-count', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return 0;

      // Use the same query as getUnreadNotificationCount for consistency
      const { count, error } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.sub)
        .eq('read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.sub,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  if (!user) {
    return null;
  }

  const count = unreadCount || 0;

  return (
    <Link
      href="/notifications"
      className="relative p-2 text-ink hover:text-wine transition-colors"
      title="Notifications"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-wine text-[10px] font-bold text-parchment">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

