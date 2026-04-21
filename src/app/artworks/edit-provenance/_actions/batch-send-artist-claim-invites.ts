'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  buildArtistInviteRows,
  commitCertificateInviteBatch,
} from '~/lib/certificate-claims/create-invite-batch';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';

export type BatchSendArtistClaimInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Creates certificate_claim_invites (one row per artwork, shared batch_id + token) and
 * sends a single email with one Accept link.
 */
export async function batchSendArtistClaimInvites(
  artworkIds: string[],
  inviteEmail: string,
  senderName?: string,
): Promise<BatchSendArtistClaimInvitesResult> {
  console.log('[Collection] batchSendArtistClaimInvites started', {
    count: artworkIds.length,
    inviteEmail,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { sent: 0, errors: ['You must be signed in'] };
  }

  const normalizedEmail = normalizeInviteEmail(inviteEmail);
  if (!normalizedEmail.includes('@')) {
    return { sent: 0, errors: ['Please enter a valid artist email'] };
  }

  const { rows, titles, errors: buildErrors } = await buildArtistInviteRows(
    client,
    user.id,
    artworkIds,
  );
  const errors: string[] = [...buildErrors];

  if (rows.length === 0) {
    console.log('[Collection] batchSendArtistClaimInvites: no valid invites');
    return { sent: 0, errors };
  }

  const result = await commitCertificateInviteBatch({
    userId: user.id,
    inviteeEmail: normalizedEmail,
    rows,
    email: { variant: 'artist', artworkTitles: titles, senderName },
    createdByUserId: user.id,
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors);
  }

  console.log('[Collection] batchSendArtistClaimInvites finished', {
    sent: result.sent,
    errorCount: errors.length,
  });

  if (result.sent === 0 && errors.length === 0) {
    errors.push('Could not send invites');
  }

  return { sent: result.sent, errors };
}
