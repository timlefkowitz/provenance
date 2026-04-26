import { randomUUID } from 'crypto';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES, getUserRole, USER_ROLES } from '~/lib/user-roles';
import { generateClaimToken, hashClaimToken, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import {
  sendBatchArtistCoaInviteEmail,
  sendBatchCollectorCooInviteEmail,
  sendBatchGalleryCoSInviteEmail,
} from '~/lib/certificate-claims/send-certificate-invite-email';

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_DAY = 20;

export type InviteRowInput = {
  source_artwork_id: string;
  claim_kind: string;
  provenance_update_request_id?: string | null;
};

export type CommitInviteBatchEmail =
  | { variant: 'artist'; artworkTitles: string[]; senderName?: string }
  | { variant: 'owner'; artworkTitles: string[] }
  | { variant: 'gallery'; artworkTitles: string[]; recipientRole: 'gallery' | 'institution' };

export type CommitInviteBatchResult = {
  sent: number;
  errors: string[];
  batchId: string | null;
  token: string | null;
};

async function notifyInviteeIfUserExists(params: {
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>;
  inviteeEmail: string;
  batchId: string;
  createdByUserId: string;
  workCount: number;
}): Promise<void> {
  const { adminClient, inviteeEmail, batchId, createdByUserId, workCount } = params;
  try {
    const { data: userId, error } = await (adminClient as any).rpc(
      'get_user_id_by_email_for_notifications',
      { p_email: inviteeEmail },
    );
    if (error || !userId) {
      console.log('[Certificates] notifyInviteeIfUserExists: no user for email', {
        inviteeEmail,
        rpcError: error?.message,
      });
      return;
    }
    console.log('[Certificates] notifyInviteeIfUserExists: notifying user', { userId });
    await createNotification({
      userId: userId as string,
      type: 'certificate_claim_pending',
      title:
        workCount === 1
          ? 'Pending certificate claim'
          : `Pending certificate claims (${workCount} works)`,
      message:
        'You have certificate invites to accept. Open Pending claims in the portal to complete them.',
      metadata: { batch_id: batchId, path: '/portal/pending-claims' },
      relatedUserId: createdByUserId,
    });
  } catch (e) {
    console.error('[Certificates] notifyInviteeIfUserExists failed', e);
    logger.error('notify_invitee_pending_claim_failed', { error: e });
  }
}

/**
 * Insert N invite rows sharing one batch_id and token_hash, send one email, optionally notify in-app.
 */
export async function commitCertificateInviteBatch(params: {
  userId: string;
  inviteeEmail: string;
  rows: InviteRowInput[];
  email: CommitInviteBatchEmail;
  createdByUserId: string;
  enforceOwnerRateLimit?: boolean;
}): Promise<CommitInviteBatchResult> {
  const {
    inviteeEmail,
    rows,
    email,
    createdByUserId,
    enforceOwnerRateLimit,
  } = params;

  const errors: string[] = [];
  if (rows.length === 0) {
    return { sent: 0, errors: ['No valid invites'], batchId: null, token: null };
  }

  const normalizedEmail = normalizeInviteEmail(inviteeEmail);
  const adminClient = getSupabaseServerAdminClient();

  if (enforceOwnerRateLimit) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { count, error: countError } = await (adminClient as any)
        .from('certificate_claim_invites')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', createdByUserId)
        .gte('created_at', since);

      if (!countError && count != null && count >= MAX_INVITES_PER_DAY) {
        return {
          sent: 0,
          errors: ['Too many invites sent recently. Try again tomorrow.'],
          batchId: null,
          token: null,
        };
      }
    } catch (rateErr) {
      console.error('[Certificates] commitCertificateInviteBatch rate limit check failed', rateErr);
    }
  }

  const batchId = randomUUID();
  const token = generateClaimToken();
  const tokenHash = hashClaimToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const insertPayload = rows.map((r) => ({
    source_artwork_id: r.source_artwork_id,
    claim_kind: r.claim_kind,
    invitee_email: normalizedEmail,
    token_hash: tokenHash,
    batch_id: batchId,
    status: 'sent',
    expires_at: expiresAt,
    created_by: createdByUserId,
    provenance_update_request_id: r.provenance_update_request_id ?? null,
  }));

  const { error: insertError } = await (adminClient as any)
    .from('certificate_claim_invites')
    .insert(insertPayload);

  if (insertError) {
    console.error('[Certificates] commitCertificateInviteBatch insert failed', insertError);
    logger.error('commit_invite_batch_insert_failed', { error: insertError });
    return {
      sent: 0,
      errors: ['Could not create invite records'],
      batchId: null,
      token: null,
    };
  }

  await notifyInviteeIfUserExists({
    adminClient,
    inviteeEmail: normalizedEmail,
    batchId,
    createdByUserId,
    workCount: rows.length,
  });

  try {
    if (email.variant === 'artist') {
      await sendBatchArtistCoaInviteEmail({
        to: normalizedEmail,
        recipientName: normalizedEmail.split('@')[0] || 'there',
        artworkTitles: email.artworkTitles,
        token,
        senderName: email.senderName,
      });
    } else if (email.variant === 'owner') {
      await sendBatchCollectorCooInviteEmail({
        to: normalizedEmail,
        recipientName: normalizedEmail.split('@')[0] || 'there',
        artworkTitles: email.artworkTitles,
        token,
      });
    } else {
      await sendBatchGalleryCoSInviteEmail({
        to: normalizedEmail,
        recipientName: normalizedEmail.split('@')[0] || 'there',
        artworkTitles: email.artworkTitles,
        recipientRole: email.recipientRole,
        token,
      });
    }
    console.log('[Certificates] commitCertificateInviteBatch: email sent', {
      variant: email.variant,
      count: rows.length,
    });
  } catch (emailError) {
    console.error('[Certificates] commitCertificateInviteBatch email failed', emailError);
    logger.error('commit_invite_batch_email_failed', { error: emailError });
    errors.push(
      'Email delivery failed — invite records were created but the email was not sent',
    );
  }

  return {
    sent: rows.length,
    errors,
    batchId,
    token,
  };
}

/**
 * Build artist invite rows from selected artwork IDs (CoS / CoO → CoA flow).
 */
export async function buildArtistInviteRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  artworkIds: string[],
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];

  for (const artworkId of artworkIds) {
    try {
      const { data: artwork, error: artworkError } = await (client as any)
        .from('artworks')
        .select('id, account_id, title, artist_name, certificate_type, certificate_status')
        .eq('id', artworkId)
        .single();

      if (artworkError || !artwork) {
        errors.push(`Artwork ${artworkId}: not found`);
        continue;
      }

      if (artwork.account_id !== userId) {
        errors.push(`"${artwork.title}": not owned by you`);
        continue;
      }

      if (!artwork.artist_name?.trim()) {
        errors.push(`"${artwork.title}": add artist name before sending`);
        continue;
      }

      const certType = artwork.certificate_type || 'authenticity';
      let claimKind: 'artist_coa_from_show' | 'artist_coa_from_coo' | null = null;

      if (certType === CERTIFICATE_TYPES.SHOW) {
        claimKind = 'artist_coa_from_show';
      } else if (certType === CERTIFICATE_TYPES.OWNERSHIP) {
        claimKind = 'artist_coa_from_coo';
      } else if (artwork.certificate_status === 'pending_artist_claim') {
        const { data: ownerAccount } = await (client as any)
          .from('accounts')
          .select('public_data')
          .eq('id', artwork.account_id)
          .single();
        const ownerRole = getUserRole(
          ownerAccount?.public_data as Record<string, unknown> | null,
        );
        if (ownerRole === USER_ROLES.GALLERY || ownerRole === USER_ROLES.INSTITUTION) {
          claimKind = 'artist_coa_from_show';
        } else if (ownerRole === USER_ROLES.COLLECTOR) {
          claimKind = 'artist_coa_from_coo';
        }
      }

      if (!claimKind) {
        errors.push(
          `"${artwork.title}": must be a Certificate of Show or Certificate of Ownership`,
        );
        continue;
      }

      rows.push({
        source_artwork_id: artworkId,
        claim_kind: claimKind,
        provenance_update_request_id: null,
      });
      titles.push(artwork.title as string);
    } catch (err) {
      console.error('[Certificates] buildArtistInviteRows error', { artworkId, err });
      errors.push(`Artwork ${artworkId}: unexpected error`);
    }
  }

  return { rows, titles, errors };
}

/**
 * Build owner (collector COO) invite rows; each source must be an authenticity cert.
 */
export async function buildOwnerInviteRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
  inviteeEmail: string,
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];
  const normalizedEmail = normalizeInviteEmail(inviteeEmail);

  for (const artworkId of artworkIds) {
    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      errors.push(`Artwork ${artworkId}: not found`);
      continue;
    }

    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title}": not owned by you`);
      continue;
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
      errors.push(
        `"${artwork.title}": only a Certificate of Authenticity can invite a linked Certificate of Ownership`,
      );
      continue;
    }

    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', normalizedEmail)
      .eq('claim_kind', 'owner_coownership_from_coa')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      errors.push(
        `"${artwork.title}": an open invite already exists for this email`,
      );
      continue;
    }

    rows.push({
      source_artwork_id: artworkId,
      claim_kind: 'owner_coownership_from_coa',
      provenance_update_request_id: null,
    });
    titles.push((artwork.title as string) || 'Untitled');
  }

  return { rows, titles, errors };
}

/**
 * Build gallery CoS invite rows from artist CoAs.
 */
export async function buildGalleryCoSInviteRows(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];

  const { data: artworks, error: artworksError } = await (adminClient as any)
    .from('artworks')
    .select('id, title, artist_name, certificate_type, account_id')
    .in('id', artworkIds);

  if (artworksError || !artworks?.length) {
    return {
      rows: [],
      titles: [],
      errors: ['Could not load selected artworks'],
    };
  }

  for (const artwork of artworks as Array<{
    id: string;
    title: string | null;
    certificate_type: string | null;
    account_id: string;
  }>) {
    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title ?? artwork.id}": not owned by you`);
      continue;
    }
    if (artwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
      errors.push(
        `"${artwork.title ?? 'Work'}": must be a Certificate of Authenticity`,
      );
      continue;
    }
    rows.push({
      source_artwork_id: artwork.id,
      claim_kind: 'gallery_cos_from_artist',
      provenance_update_request_id: null,
    });
    titles.push(artwork.title ?? artwork.id);
  }

  return { rows, titles, errors };
}

// ============================================================================
// NEW: COO-first flows (Collector creates root, invites artist and gallery)
// ============================================================================

/**
 * Build artist invite rows from a collector's COO that is the root certificate.
 * Used when collector owns artwork and wants artist to create COA.
 */
export async function buildArtistInviteFromCooRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
  inviteeEmail: string,
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];
  const normalizedEmail = normalizeInviteEmail(inviteeEmail);

  for (const artworkId of artworkIds) {
    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, artist_name, certificate_type, source_artwork_id')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      errors.push(`Artwork ${artworkId}: not found`);
      continue;
    }

    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title}": not owned by you`);
      continue;
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.OWNERSHIP) {
      errors.push(
        `"${artwork.title}": must be a Certificate of Ownership to invite artist for COA`,
      );
      continue;
    }

    // Check if this COO is a root (no source_artwork_id)
    if (artwork.source_artwork_id) {
      errors.push(
        `"${artwork.title}": this COO is already linked to another certificate. Use the standard artist invite flow.`,
      );
      continue;
    }

    if (!artwork.artist_name?.trim()) {
      errors.push(`"${artwork.title}": add artist name before sending invite`);
      continue;
    }

    // Check for existing open invites
    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', normalizedEmail)
      .eq('claim_kind', 'artist_coa_from_coo_root')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      errors.push(`"${artwork.title}": an open invite already exists for this email`);
      continue;
    }

    rows.push({
      source_artwork_id: artworkId,
      claim_kind: 'artist_coa_from_coo_root',
      provenance_update_request_id: null,
    });
    titles.push((artwork.title as string) || 'Untitled');
  }

  return { rows, titles, errors };
}

/**
 * Build gallery COS invite rows from a collector's COO.
 * Used when collector wants gallery to create Certificate of Show for their artwork.
 */
export async function buildGalleryInviteFromCooRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
  inviteeEmail: string,
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];
  const normalizedEmail = normalizeInviteEmail(inviteeEmail);

  for (const artworkId of artworkIds) {
    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      errors.push(`Artwork ${artworkId}: not found`);
      continue;
    }

    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title}": not owned by you`);
      continue;
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.OWNERSHIP) {
      errors.push(
        `"${artwork.title}": must be a Certificate of Ownership to invite gallery for COS`,
      );
      continue;
    }

    // Check for existing open invites
    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', normalizedEmail)
      .eq('claim_kind', 'gallery_cos_from_coo')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      errors.push(`"${artwork.title}": an open invite already exists for this email`);
      continue;
    }

    rows.push({
      source_artwork_id: artworkId,
      claim_kind: 'gallery_cos_from_coo',
      provenance_update_request_id: null,
    });
    titles.push((artwork.title as string) || 'Untitled');
  }

  return { rows, titles, errors };
}

// ============================================================================
// NEW: COS-first flows (Gallery creates root, invites artist and collector)
// ============================================================================

/**
 * Build artist invite rows from a gallery's COS that is the root certificate.
 * Used when gallery has artwork in exhibition and wants artist to create COA.
 */
export async function buildArtistInviteFromCosRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
  inviteeEmail: string,
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];
  const normalizedEmail = normalizeInviteEmail(inviteeEmail);

  for (const artworkId of artworkIds) {
    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, artist_name, certificate_type, source_artwork_id')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      errors.push(`Artwork ${artworkId}: not found`);
      continue;
    }

    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title}": not owned by you`);
      continue;
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.SHOW) {
      errors.push(
        `"${artwork.title}": must be a Certificate of Show to invite artist for COA`,
      );
      continue;
    }

    // Check if this COS is a root (no source_artwork_id)
    if (artwork.source_artwork_id) {
      errors.push(
        `"${artwork.title}": this COS is already linked to another certificate. Use the standard artist invite flow.`,
      );
      continue;
    }

    if (!artwork.artist_name?.trim()) {
      errors.push(`"${artwork.title}": add artist name before sending invite`);
      continue;
    }

    // Check for existing open invites
    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', normalizedEmail)
      .eq('claim_kind', 'artist_coa_from_cos_root')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      errors.push(`"${artwork.title}": an open invite already exists for this email`);
      continue;
    }

    rows.push({
      source_artwork_id: artworkId,
      claim_kind: 'artist_coa_from_cos_root',
      provenance_update_request_id: null,
    });
    titles.push((artwork.title as string) || 'Untitled');
  }

  return { rows, titles, errors };
}

/**
 * Build collector COO invite rows from a gallery's COS.
 * Used when gallery has artwork in exhibition and collector purchases it.
 */
export async function buildOwnerInviteFromCosRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  artworkIds: string[],
  inviteeEmail: string,
): Promise<{
  rows: InviteRowInput[];
  titles: string[];
  errors: string[];
}> {
  const rows: InviteRowInput[] = [];
  const titles: string[] = [];
  const errors: string[] = [];
  const normalizedEmail = normalizeInviteEmail(inviteeEmail);

  for (const artworkId of artworkIds) {
    const { data: artwork, error: artError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, certificate_type')
      .eq('id', artworkId)
      .single();

    if (artError || !artwork) {
      errors.push(`Artwork ${artworkId}: not found`);
      continue;
    }

    if (artwork.account_id !== userId) {
      errors.push(`"${artwork.title}": not owned by you`);
      continue;
    }

    if (artwork.certificate_type !== CERTIFICATE_TYPES.SHOW) {
      errors.push(
        `"${artwork.title}": must be a Certificate of Show to invite collector for COO`,
      );
      continue;
    }

    // Check for existing open invites
    const { data: existingOpen } = await (adminClient as any)
      .from('certificate_claim_invites')
      .select('id')
      .eq('source_artwork_id', artworkId)
      .eq('invitee_email', normalizedEmail)
      .eq('claim_kind', 'owner_coo_from_cos')
      .in('status', ['pending', 'pending_owner_approval', 'sent'])
      .maybeSingle();

    if (existingOpen) {
      errors.push(`"${artwork.title}": an open invite already exists for this email`);
      continue;
    }

    rows.push({
      source_artwork_id: artworkId,
      claim_kind: 'owner_coo_from_cos',
      provenance_update_request_id: null,
    });
    titles.push((artwork.title as string) || 'Untitled');
  }

  return { rows, titles, errors };
}
