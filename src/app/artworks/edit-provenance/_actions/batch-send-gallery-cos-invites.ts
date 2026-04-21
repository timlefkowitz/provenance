'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  buildGalleryCoSInviteRows,
  commitCertificateInviteBatch,
} from '~/lib/certificate-claims/create-invite-batch';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';

export type BatchSendGalleryCoSInvitesResult = {
  sent: number;
  errors: string[];
};

/**
 * Batch gallery/institution CoS invites: one batch_id, one email, one accept for all.
 */
export async function batchSendGalleryCoSInvites(
  artworkIds: string[],
  inviteEmail: string,
  recipientRole: 'gallery' | 'institution',
): Promise<BatchSendGalleryCoSInvitesResult> {
  console.log('[Collection] batchSendGalleryCoSInvites started', {
    count: artworkIds.length,
    recipientRole,
  });

  if (artworkIds.length === 0) {
    return { sent: 0, errors: ['No artworks selected'] };
  }

  const normalizedEmail = normalizeInviteEmail(inviteEmail);
  if (!normalizedEmail.includes('@')) {
    return { sent: 0, errors: ['Please enter a valid email address'] };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { sent: 0, errors: ['You must be signed in'] };
  }

  const adminClient = getSupabaseServerAdminClient();
  const { rows, titles, errors: buildErrors } = await buildGalleryCoSInviteRows(
    adminClient,
    user.id,
    artworkIds,
  );
  const errors: string[] = [...buildErrors];

  if (rows.length === 0) {
    return {
      sent: 0,
      errors: errors.length > 0 ? errors : ['Could not load valid artworks'],
    };
  }

  const result = await commitCertificateInviteBatch({
    userId: user.id,
    inviteeEmail: normalizedEmail,
    rows,
    email: { variant: 'gallery', artworkTitles: titles, recipientRole },
    createdByUserId: user.id,
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors);
  }

  console.log('[Collection] batchSendGalleryCoSInvites finished', {
    sent: result.sent,
    errorCount: errors.length,
  });

  return { sent: result.sent, errors };
}
