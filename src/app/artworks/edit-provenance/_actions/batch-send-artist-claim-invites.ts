'use server';

import { sendArtistClaimInvite } from '~/app/artworks/[id]/certificate/_actions/send-artist-claim-invite';

export type BatchSendArtistClaimInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Batch wrapper around sendArtistClaimInvite.
 * Sends a Certificate of Authenticity claim invite to the artist email
 * for each selected artwork (must be CoS or CoO type certificates).
 */
export async function batchSendArtistClaimInvites(
  artworkIds: string[],
  inviteEmail: string,
): Promise<BatchSendArtistClaimInvitesResult> {
  console.log('[Collection] batchSendArtistClaimInvites started', {
    count: artworkIds.length,
    inviteEmail,
  });

  const errors: string[] = [];
  let sent = 0;

  for (const artworkId of artworkIds) {
    const result = await sendArtistClaimInvite(artworkId, inviteEmail);
    if (result.success) {
      sent++;
    } else {
      errors.push(result.error ?? `Failed for artwork ${artworkId}`);
    }
  }

  console.log('[Collection] batchSendArtistClaimInvites finished', { sent, errorCount: errors.length });
  return { sent, errors };
}
