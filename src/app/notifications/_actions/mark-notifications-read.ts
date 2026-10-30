'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';

async function requireUserId(client: UntypedSupabaseClient): Promise<string> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('You must be signed in');
  return user.id;
}

/**
 * Mark one of the signed-in user's notifications as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const client = asUntyped(getSupabaseServerClient());
  const userId = await requireUserId(client);

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

/**
 * Mark all of the signed-in user's notifications as read
 */
export async function markAllNotificationsAsRead() {
  const client = asUntyped(getSupabaseServerClient());
  const userId = await requireUserId(client);

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}
