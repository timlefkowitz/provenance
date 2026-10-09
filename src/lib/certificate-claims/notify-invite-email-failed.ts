import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';

/**
 * Tell the sender in-app that a certificate invite email was rejected by the
 * email provider, so the failure is visible after the toast is gone.
 */
export async function notifyInviteEmailFailed(params: {
  senderUserId: string;
  inviteeEmail: string;
  artworkTitles: string[];
  artworkId?: string;
  reason: string;
}): Promise<void> {
  const { senderUserId, inviteeEmail, artworkTitles, artworkId, reason } = params;
  const count = artworkTitles.length;
  const what =
    count === 1
      ? `the Certificate of Ownership invite for "${artworkTitles[0]}"`
      : `the Certificate of Ownership invite for ${count} works`;
  try {
    await createNotification({
      userId: senderUserId,
      type: 'invite_email_failed',
      title: `Email to ${inviteeEmail} was not delivered`,
      message: `We couldn't send ${what} (${reason}). Check the address and send the invite again.`,
      artworkId,
      metadata: { invitee_email: inviteeEmail, reason, artwork_titles: artworkTitles },
    });
  } catch (err) {
    console.error('[Certificates] notifyInviteEmailFailed failed', err);
    logger.error('notify_invite_email_failed_failed', { error: err });
  }
}
