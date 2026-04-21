'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  buildOwnerInviteRows,
  commitCertificateInviteBatch,
} from '~/lib/certificate-claims/create-invite-batch';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';

export type BatchSendCollectorInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Batch collector COO invites: one batch_id, one email, one accept for all selected CoAs.
 */
export async function batchSendCollectorInvites(
  artworkIds: string[],
  inviteEmail: string,
): Promise<BatchSendCollectorInvitesResult> {
  console.log('[Collection] batchSendCollectorInvites started', {
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
    return { sent: 0, errors: ['Enter a valid email address'] };
  }

  const adminClient = getSupabaseServerAdminClient();
  const { rows, titles, errors: buildErrors } = await buildOwnerInviteRows(
    client,
    adminClient,
    user.id,
    artworkIds,
    inviteEmail,
  );
  const errors: string[] = [...buildErrors];

  if (rows.length === 0) {
    console.log('[Collection] batchSendCollectorInvites: no valid rows');
    return { sent: 0, errors };
  }

  const result = await commitCertificateInviteBatch({
    userId: user.id,
    inviteeEmail: normalizedEmail,
    rows,
    email: { variant: 'owner', artworkTitles: titles },
    createdByUserId: user.id,
    enforceOwnerRateLimit: true,
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors);
  }

  console.log('[Collection] batchSendCollectorInvites finished', {
    sent: result.sent,
    errorCount: errors.length,
  });

  return { sent: result.sent, errors };
}
