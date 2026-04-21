'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES, getUserRole, USER_ROLES } from '~/lib/user-roles';
import { hashClaimToken, emailsMatch, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import {
  insertLinkedCertificateOfOwnershipFromCoa,
  insertArtistCoaFromSourceCertificate,
} from '~/lib/certificate-claims/insert-linked-certificate';
import { insertLinkedCoSFromArtistCoa } from '~/lib/certificate-claims/insert-linked-cos-from-artist-coa';

export type ConsumeCertificateClaimResult =
  | { success: true; artworkId: string }
  | { success: false; error: string };

type InviteRow = Record<string, unknown>;

function sortInvites(invites: InviteRow[]): InviteRow[] {
  return [...invites].sort(
    (a, b) =>
      new Date((a.created_at as string) || 0).getTime() -
      new Date((b.created_at as string) || 0).getTime(),
  );
}

async function validateInviteeEmail(userEmail: string, invite: InviteRow): Promise<string | null> {
  const inviteeEmail = normalizeInviteEmail(invite.invitee_email as string);
  if (!emailsMatch(userEmail, inviteeEmail)) {
    console.error('[Certificates] processInvites email mismatch', {});
    return `Sign in with the email this invite was sent to (${inviteeEmail}).`;
  }
  return null;
}

async function validateExpiry(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  invite: InviteRow,
): Promise<string | null> {
  const expiresAt = new Date(invite.expires_at as string);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    await (adminClient as any)
      .from('certificate_claim_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return 'This claim link has expired';
  }
  return null;
}

/**
 * Shared claim processing for token link and portal batch accept.
 */
async function processInvitesAfterAuth(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  user: { id: string; email?: string | null },
  invites: InviteRow[],
): Promise<ConsumeCertificateClaimResult> {
  const sorted = sortInvites(invites);
  const first = sorted[0];
  if (!first) {
    return { success: false, error: 'Invalid claim' };
  }

  const userEmail = user.email;
  if (!userEmail) {
    return { success: false, error: 'Your account has no email; add one to complete this claim' };
  }

  const emailErr = await validateInviteeEmail(userEmail, first);
  if (emailErr) {
    return { success: false, error: emailErr };
  }

  const status = first.status as string;
  if (status === 'consumed' && first.result_artwork_id) {
    revalidatePath(`/artworks/${first.result_artwork_id}/certificate`);
    return { success: true, artworkId: first.result_artwork_id as string };
  }

  if (status === 'cancelled' || status === 'expired') {
    return { success: false, error: 'This claim link is no longer valid' };
  }

  if (status !== 'sent' && status !== 'pending') {
    return { success: false, error: 'This claim link is not ready to use' };
  }

  const expErr = await validateExpiry(adminClient, first);
  if (expErr) {
    return { success: false, error: expErr };
  }

  const kind = first.claim_kind as string;
  for (const inv of sorted) {
    if ((inv.claim_kind as string) !== kind) {
      return { success: false, error: 'Invalid batch: mixed claim types' };
    }
  }

  if (kind === 'owner_coownership_from_coa') {
    return processOwnerBatch(client, adminClient, user, sorted);
  }

  if (kind === 'gallery_cos_from_artist') {
    return processGalleryBatch(client, adminClient, user, sorted);
  }

  if (kind === 'artist_coa_from_show' || kind === 'artist_coa_from_coo') {
    return processArtistBatch(client, adminClient, user, sorted);
  }

  return { success: false, error: 'Unsupported claim type' };
}

async function processOwnerBatch(
  _client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  user: { id: string },
  invites: InviteRow[],
): Promise<ConsumeCertificateClaimResult> {
  const now = new Date().toISOString();
  let firstNewId: string | null = null;

  for (const invite of invites) {
    const { data: sourceArtwork, error: sourceError } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('id', invite.source_artwork_id as string)
      .single();

    if (sourceError || !sourceArtwork) {
      logger.error('consume_owner_batch_source_failed', { error: sourceError });
      return { success: false, error: 'Could not load source certificate' };
    }

    if (sourceArtwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
      return { success: false, error: 'Invalid source certificate for this claim' };
    }

    const { id: newId } = await insertLinkedCertificateOfOwnershipFromCoa(adminClient, sourceArtwork, {
      ownerAccountId: user.id,
      createdByUserId: user.id,
    });

    if (!firstNewId) {
      firstNewId = newId;
    }

    await (adminClient as any)
      .from('certificate_claim_invites')
      .update({
        status: 'consumed',
        consumed_at: now,
        consumed_by: user.id,
        result_artwork_id: newId,
      })
      .eq('id', invite.id);

    try {
      await createNotification({
        userId: sourceArtwork.account_id as string,
        type: 'certificate_claimed',
        title: `Certificate of Ownership claimed: ${sourceArtwork.title}`,
        message: `A collector has claimed their Certificate of Ownership for "${sourceArtwork.title}".`,
        artworkId: newId,
        relatedUserId: user.id,
      });
    } catch (e) {
      logger.error('consume_coo_owner_notify_failed', { error: e });
    }

    revalidatePath(`/artworks/${newId}/certificate`);
  }

  revalidatePath('/portal');
  return { success: true, artworkId: firstNewId! };
}

async function processGalleryBatch(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  user: { id: string },
  invites: InviteRow[],
): Promise<ConsumeCertificateClaimResult> {
  const { data: account } = await (client as any)
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const role = getUserRole(account.public_data as Record<string, unknown>);
  if (role !== USER_ROLES.GALLERY && role !== USER_ROLES.INSTITUTION) {
    return { success: false, error: 'Only gallery or institution accounts can claim this certificate' };
  }

  const { data: galleryProfile } = await (client as any)
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', role)
    .eq('is_active', true)
    .maybeSingle();

  const now = new Date().toISOString();
  let firstNewId: string | null = null;

  for (const invite of invites) {
    const { data: sourceArtwork, error: sourceError } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('id', invite.source_artwork_id as string)
      .single();

    if (sourceError || !sourceArtwork) {
      return { success: false, error: 'Could not load source certificate' };
    }

    console.log('[Certificates] processGalleryBatch', {
      sourceArtworkId: sourceArtwork.id,
      galleryAccountId: user.id,
      role,
    });

    const { id: newId } = await insertLinkedCoSFromArtistCoa(adminClient, sourceArtwork, {
      galleryAccountId: user.id,
      createdByUserId: user.id,
      galleryProfileId: galleryProfile?.id ?? null,
    });

    if (!firstNewId) {
      firstNewId = newId;
    }

    await (adminClient as any)
      .from('certificate_claim_invites')
      .update({
        status: 'consumed',
        consumed_at: now,
        consumed_by: user.id,
        result_artwork_id: newId,
      })
      .eq('id', invite.id);

    try {
      await createNotification({
        userId: sourceArtwork.account_id as string,
        type: 'certificate_claimed',
        title: `Certificate of Show created: ${sourceArtwork.title}`,
        message: `A ${role} has created a Certificate of Show for "${sourceArtwork.title}" linked to your provenance record.`,
        artworkId: newId,
        relatedUserId: user.id,
      });
    } catch (e) {
      logger.error('consume_gallery_cos_owner_notify_failed', { error: e });
    }

    revalidatePath(`/artworks/${newId}/certificate`);
  }

  revalidatePath('/portal');
  return { success: true, artworkId: firstNewId! };
}

async function processArtistBatch(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  user: { id: string },
  invites: InviteRow[],
): Promise<ConsumeCertificateClaimResult> {
  const first = invites[0]!;
  const requestId = first.provenance_update_request_id as string | null;

  if (requestId) {
    const { data: provRequest, error: reqErr } = await (adminClient as any)
      .from('provenance_update_requests')
      .select('id, requested_by, status, request_type')
      .eq('id', requestId)
      .single();

    if (reqErr || !provRequest || provRequest.request_type !== 'artist_claim') {
      return { success: false, error: 'Claim request not found' };
    }

    if (provRequest.status !== 'approved') {
      return { success: false, error: 'This claim has not been approved yet' };
    }

    if (provRequest.requested_by !== user.id) {
      return {
        success: false,
        error: 'You must sign in as the artist who submitted this claim',
      };
    }
  } else {
    const { data: account } = await (client as any)
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const role = getUserRole(account.public_data as Record<string, unknown>);
    if (role !== USER_ROLES.ARTIST) {
      return { success: false, error: 'Only artist accounts can claim this certificate' };
    }
  }

  const kind = first.claim_kind as string;
  const expectedType =
    kind === 'artist_coa_from_show' ? CERTIFICATE_TYPES.SHOW : CERTIFICATE_TYPES.OWNERSHIP;

  const useHeuristicBulk =
    invites.length === 1 && !(first as { batch_id?: string | null }).batch_id;

  console.log('[Certificates] processArtistBatch', {
    inviteCount: invites.length,
    useHeuristicBulk,
  });

  let sourcesToClaim: Record<string, unknown>[] = [];
  const createdBySource = new Map<string, string>();

  if (useHeuristicBulk) {
    const invite = invites[0]!;
    const { data: sourceArtwork, error: sourceError } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('id', invite.source_artwork_id as string)
      .single();

    if (sourceError || !sourceArtwork) {
      return { success: false, error: 'Could not load source certificate' };
    }

    if (sourceArtwork.certificate_type !== expectedType) {
      return { success: false, error: 'Invalid source certificate for this claim' };
    }

    const { data: candidateSources, error: candidateSourcesError } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('account_id', sourceArtwork.account_id as string)
      .eq('artist_name', sourceArtwork.artist_name)
      .in('certificate_type', [CERTIFICATE_TYPES.SHOW, CERTIFICATE_TYPES.OWNERSHIP]);

    if (candidateSourcesError) {
      logger.error('consume_artist_coa_bulk_candidates_failed', {
        error: candidateSourcesError,
      });
      return { success: false, error: 'Could not load related certificates for bulk claim' };
    }

    const candidateIds = (candidateSources ?? []).map((a: { id: string }) => a.id);
    const { data: existingCoas, error: existingCoasError } = await (adminClient as any)
      .from('artworks')
      .select('source_artwork_id')
      .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
      .eq('artist_account_id', user.id)
      .in('source_artwork_id', candidateIds);

    if (existingCoasError) {
      logger.error('consume_artist_coa_bulk_existing_failed', { error: existingCoasError });
    }

    const existingSourceIds = new Set(
      (existingCoas ?? [])
        .map((row: { source_artwork_id?: string | null }) => row.source_artwork_id)
        .filter(Boolean) as string[],
    );

    sourcesToClaim = (candidateSources ?? []).filter(
      (candidate: { id: string }) => !existingSourceIds.has(candidate.id),
    ) as Record<string, unknown>[];
  } else {
    const candidateIds = invites.map((i) => i.source_artwork_id as string);
    const { data: existingCoaRows } = await (adminClient as any)
      .from('artworks')
      .select('id, source_artwork_id')
      .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
      .eq('artist_account_id', user.id)
      .in('source_artwork_id', candidateIds);

    const existingCoaBySource = new Map<string, string>();
    for (const row of existingCoaRows ?? []) {
      const sid = row.source_artwork_id as string;
      if (sid) {
        existingCoaBySource.set(sid, row.id as string);
      }
    }

    for (const inv of invites) {
      const sid = inv.source_artwork_id as string;
      const existingCoaId = existingCoaBySource.get(sid);
      if (existingCoaId) {
        createdBySource.set(sid, existingCoaId);
        continue;
      }
      const { data: art, error: aerr } = await (adminClient as any)
        .from('artworks')
        .select('*')
        .eq('id', sid)
        .single();
      if (aerr || !art) {
        logger.error('consume_artist_batch_source_failed', { sid, error: aerr });
        continue;
      }
      if (art.certificate_type !== expectedType) {
        return { success: false, error: 'Invalid source certificate for this claim' };
      }
      sourcesToClaim.push(art as Record<string, unknown>);
    }
  }

  if (sourcesToClaim.length === 0 && createdBySource.size === 0) {
    return {
      success: false,
      error: 'These certificates were already claimed for this artist account',
    };
  }

  const createdCoaIds: string[] = [];
  let primaryCoaId: string | null = null;
  const firstSourceId = (invites[0]!.source_artwork_id as string) || null;

  for (const sourceCandidate of sourcesToClaim) {
    try {
      const { id: createdId } = await insertArtistCoaFromSourceCertificate(
        adminClient,
        sourceCandidate,
        {
          artistAccountId: user.id,
          createdByUserId: user.id,
        },
      );
      createdCoaIds.push(createdId);
      createdBySource.set(sourceCandidate.id as string, createdId);
      if (sourceCandidate.id === firstSourceId) {
        primaryCoaId = createdId;
      }
    } catch (bulkInsertError) {
      logger.error('consume_artist_coa_bulk_insert_failed', {
        sourceArtworkId: sourceCandidate.id,
        error: bulkInsertError,
      });
    }
  }

  if (!primaryCoaId) {
    primaryCoaId = createdCoaIds[0] ?? null;
  }
  if (!primaryCoaId && createdBySource.size > 0) {
    primaryCoaId = Array.from(createdBySource.values())[0] ?? null;
  }

  if (!primaryCoaId) {
    return { success: false, error: 'Failed to create Certificate of Authenticity' };
  }

  const now = new Date().toISOString();
  let sourceArtwork =
    sourcesToClaim.find((s) => s.id === firstSourceId) ?? sourcesToClaim[0];
  if (!sourceArtwork) {
    const { data: srcRow } = await (adminClient as any)
      .from('artworks')
      .select('*')
      .eq('id', firstSourceId)
      .single();
    sourceArtwork = srcRow as Record<string, unknown>;
  }
  if (!sourceArtwork) {
    return { success: false, error: 'Could not load source artwork for notification' };
  }

  for (const invite of invites) {
    const sid = invite.source_artwork_id as string;
    const resultId = createdBySource.get(sid) ?? primaryCoaId;
    await (adminClient as any)
      .from('certificate_claim_invites')
      .update({
        status: 'consumed',
        consumed_at: now,
        consumed_by: user.id,
        result_artwork_id: resultId,
      })
      .eq('id', invite.id);
  }

  try {
    await createNotification({
      userId: user.id,
      type: 'certificate_verified',
      title: `Certificate of Authenticity ready: ${sourceArtwork.title}`,
      message:
        createdCoaIds.length > 1
          ? `Your claim completed. We created ${createdCoaIds.length} linked Certificates of Authenticity for this artist under this owner.`
          : `Your Certificate of Authenticity for "${sourceArtwork.title}" is linked to this work.`,
      artworkId: primaryCoaId,
      relatedUserId: sourceArtwork.account_id as string,
      metadata: { source_artwork_id: sourceArtwork.id },
    });
  } catch (e) {
    logger.error('consume_artist_coa_notify_failed', { error: e });
  }

  const autoClaimedAdditionalCount = Math.max(createdCoaIds.length - 1, 0);
  if (autoClaimedAdditionalCount > 0 && useHeuristicBulk) {
    try {
      await createNotification({
        userId: sourceArtwork.account_id as string,
        type: 'artist_claim_other_certificates',
        title: `Auto-claimed certificates for ${sourceArtwork.artist_name}`,
        message: `The artist claim for "${sourceArtwork.title}" auto-created ${autoClaimedAdditionalCount} additional linked Certificate(s) of Authenticity for this artist.`,
        artworkId: sourceArtwork.id as string,
        relatedUserId: user.id,
        metadata: { created_coa_ids: createdCoaIds, total_created: createdCoaIds.length },
      });
    } catch (e) {
      logger.error('consume_artist_coa_owner_auto_claim_notify_failed', { error: e });
    }
  }

  revalidatePath('/portal');
  revalidatePath(`/artworks/${primaryCoaId}/certificate`);
  return { success: true, artworkId: primaryCoaId };
}

export async function consumeCertificateClaim(
  token: string,
): Promise<ConsumeCertificateClaimResult> {
  console.log('[Certificates] consumeCertificateClaim started');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to claim this certificate' };
    }

    const trimmed = token?.trim();
    if (!trimmed) {
      return { success: false, error: 'Invalid or missing claim link' };
    }

    const tokenHash = hashClaimToken(trimmed);
    const adminClient = getSupabaseServerAdminClient();

    const { data: invites, error: inviteError } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('*')
      .eq('token_hash', tokenHash);

    if (inviteError || !invites?.length) {
      console.error('[Certificates] consumeCertificateClaim invite lookup failed', inviteError);
      return { success: false, error: 'Invalid or expired claim link' };
    }

    return await processInvitesAfterAuth(client, adminClient, user, invites as InviteRow[]);
  } catch (err) {
    console.error('[Certificates] consumeCertificateClaim failed', err);
    logger.error('consume_certificate_claim_failed', { error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Claim failed' };
  }
}

/**
 * Accept all invites in a batch from the portal (same rules as email link; no token).
 * `batchIdOrInviteId` is shared batch_id, or a single invite row id for legacy rows without batch_id.
 */
export async function consumeCertificateClaimByBatchId(
  batchIdOrInviteId: string,
): Promise<ConsumeCertificateClaimResult> {
  console.log('[Certificates] consumeCertificateClaimByBatchId started', { batchIdOrInviteId });
  try {
    const trimmed = batchIdOrInviteId?.trim();
    if (!trimmed) {
      return { success: false, error: 'Invalid batch' };
    }

    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to claim this certificate' };
    }

    const adminClient = getSupabaseServerAdminClient();

    const { data: byBatch, error: batchErr } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('*')
      .eq('batch_id', trimmed)
      .in('status', ['sent', 'pending']);

    let invites = byBatch as InviteRow[] | null;
    if (batchErr) {
      console.error('[Certificates] consumeCertificateClaimByBatchId batch lookup failed', batchErr);
    }

    if (!invites?.length) {
      const { data: one, error: oneErr } = await (adminClient as any)
        .from('certificate_claim_invites')
        .select('*')
        .eq('id', trimmed)
        .in('status', ['sent', 'pending'])
        .maybeSingle();

      if (oneErr || !one) {
        console.error('[Certificates] consumeCertificateClaimByBatchId single lookup failed', oneErr);
        return { success: false, error: 'No pending claims for this batch' };
      }
      invites = [one as InviteRow];
    }

    return await processInvitesAfterAuth(client, adminClient, user, invites as InviteRow[]);
  } catch (err) {
    console.error('[Certificates] consumeCertificateClaimByBatchId failed', err);
    logger.error('consume_certificate_claim_by_batch_failed', { error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Claim failed' };
  }
}
