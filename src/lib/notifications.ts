'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type NotificationType = 
  | 'certificate_claim_request'
  | 'certificate_claimed'
  | 'certificate_verified'
  | 'certificate_rejected'
  | 'artwork_updated'
  | 'qr_code_scanned'
  | 'provenance_update_request'
  | 'provenance_update_approved'
  | 'provenance_update_denied'
  | 'ownership_request'
  | 'ownership_approved'
  | 'ownership_denied'
  | 'message';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  artworkId?: string;
  relatedUserId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      artwork_id: params.artworkId || null,
      related_user_id: params.relatedUserId || null,
      metadata: params.metadata || {},
    });

  if (error) {
    console.error('Error creating notification:', error);
    throw new Error(`Failed to create notification: ${error.message}`);
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const client = getSupabaseServerClient();

  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId); // Ensure user can only mark their own notifications as read

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const client = getSupabaseServerClient();

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

