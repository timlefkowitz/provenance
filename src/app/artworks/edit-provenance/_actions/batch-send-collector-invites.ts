'use server';

import { createOwnerInviteFromCoa } from '~/app/claim/certificate/_actions/create-owner-invite-from-coa';

export type BatchSendCollectorInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Batch wrapper around createOwnerInviteFromCoa.
 * Invites a collector to claim a Certificate of Ownership for each selected
 * artwork (must be Certificate of Authenticity type).
 */
export async function batchSendCollectorInvites(
  artworkIds: string[],
  inviteEmail: string,
): Promise<BatchSendCollectorInvitesResult> {
  console.log('[Collection] batchSendCollectorInvites started', {
    count: artworkIds.length,
    inviteEmail,
  });

  const errors: string[] = [];
  let sent = 0;

  for (const artworkId of artworkIds) {
    const result = await createOwnerInviteFromCoa(artworkId, inviteEmail);
    if (result.success) {
      sent++;
    } else {
      errors.push(result.error ?? `Failed for artwork ${artworkId}`);
    }
  }

  console.log('[Collection] batchSendCollectorInvites finished', { sent, errorCount: errors.length });
  return { sent, errors };
}
