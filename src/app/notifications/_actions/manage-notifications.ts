'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
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
  await setNotificationRead(notificationId, true);
}

/**
 * Mark one of the signed-in user's notifications as read or unread
 */
export async function setNotificationRead(notificationId: string, read: boolean) {
  const client = asUntyped(getSupabaseServerClient());
  const userId = await requireUserId(client);

  const { error } = await client
    .from('notifications')
    .update({ read })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating notification read state:', error);
    throw new Error(`Failed to update notification: ${error.message}`);
  }
}

/**
 * Remove one of the signed-in user's notifications from their inbox
 */
export async function dismissNotification(notificationId: string) {
  const userId = await requireUserId(asUntyped(getSupabaseServerClient()));

  // Users have no delete grant on notifications; the user_id filter scopes
  // the service-role delete to the caller's own row.
  const { error } = await asUntyped(getSupabaseServerAdminClient())
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error dismissing notification:', error);
    throw new Error(`Failed to dismiss notification: ${error.message}`);
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
