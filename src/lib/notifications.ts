import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';

// Server-only on purpose: this must never become a server action. Users can't
// insert notifications themselves (RLS has no insert policy), so every write
// goes through the service role here, after the caller has done its own
// authorization. Read/mark-read actions live in app/notifications/_actions.

export type NotificationType = 
  | 'certificate_claim_request'
  | 'certificate_claim_pending'
  | 'certificate_claimed'
  | 'certificate_received'
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
  | 'artist_claim_request'
  | 'artist_claim_approved'
  | 'artist_claim_denied'
  | 'artist_claim_other_certificates'
  | 'artwork_favorited'
  | 'provenance_service_request'
  | 'provenance_updated'
  | 'message'
  | 'loan_counterparty_linked'
  | 'loan_status_update'
  | 'consignment_counterparty_linked'
  | 'consignment_status_update'
  | 'loan_expiry_reminder'
  | 'consignment_expiry_reminder'
  | 'shipment_counterparty_linked'
  | 'shipment_status_update'
  | 'insurance_counterparty_linked'
  | 'insurance_status_update'
  | 'acquisition_counterparty_linked'
  | 'acquisition_status_update'
  | 'exhibition_plan_counterparty_linked'
  | 'exhibition_plan_status_update'
  | 'inventory_location_counterparty_linked'
  | 'vendor_counterparty_linked'
  | 'trial_expiring'
  | 'subscription_payment_failed'
  | 'gallery_team_invite'
  | 'exhibition_artwork_submitted'
  | 'exhibition_artwork_selected'
  | 'exhibition_artwork_sold'
  | 'artist_artwork_sold'
  | 'artist_artwork_exhibited'
  | 'exhibition_invite'
  | 'open_call_submission_reminder'
  | 'av_scan_outage'
  | 'invite_email_failed'
  | 'owned_artwork_exhibited'
  | 'new_work_by_followed_artist'
  | 'artwork_reservation_request'
  | 'artwork_reservation_response'
  | 'artwork_inquiry';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  artworkId?: string;
  relatedUserId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user. Uses the service role, so callers must
 * already have checked that the current user is allowed to trigger it.
 */
export async function createNotification(params: CreateNotificationParams) {
  const client = asUntyped(getSupabaseServerAdminClient());

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
  const client = asUntyped(getSupabaseServerClient());

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
