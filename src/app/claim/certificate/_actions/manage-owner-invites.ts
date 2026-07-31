'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { logger } from '~/lib/logger';

export type PendingOwnerInvite = {
  id: string;
  batchId: string | null;
  inviteeEmail: string;
  expiresAt: string;
  claimKind: string;
  sourceArtworkId: string;
};

/**
 * Returns all open (sent/pending) COO invites created by the current user for a given artwork.
 * Uses admin client because certificate_claim_invites has no RLS policies for regular users.
 */
export async function getPendingOwnerInvitesForArtwork(
  artworkId: string,
): Promise<PendingOwnerInvite[]> {
  console.log('[OwnerInvites] getPendingOwnerInvitesForArtwork started', { artworkId });
  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return [];

    const { data: artwork } = await asUntyped(client)
      .from('artworks')
      .select('id, account_id')
      .eq('id', artworkId)
      .eq('account_id', user.id)
      .maybeSingle();

    if (!artwork) return [];

    const adminClient = getSupabaseServerAdminClient();
    const { data: invites, error } = await asUntyped(adminClient)
      .from('certificate_claim_invites')
      .select('id, batch_id, invitee_email, expires_at, claim_kind, source_artwork_id')
      .eq('source_artwork_id', artworkId)
      .eq('created_by', user.id)
      .in('claim_kind', ['owner_coownership_from_coa', 'owner_coownership_from_cos'])
      .in('status', ['sent', 'pending'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OwnerInvites] getPendingOwnerInvitesForArtwork query failed', error);
      return [];
    }

    return (invites ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      batchId: (row.batch_id as string | null) ?? null,
      inviteeEmail: row.invitee_email as string,
      expiresAt: row.expires_at as string,
      claimKind: row.claim_kind as string,
      sourceArtworkId: row.source_artwork_id as string,
    }));
  } catch (err) {
    console.error('[OwnerInvites] getPendingOwnerInvitesForArtwork failed', err);
    return [];
  }
}

/**
 * Cancels all invite rows for the given batch_id or invite id.
 * Only the creator of the invite can cancel it, and only if not yet consumed.
 */
export async function cancelCertificateClaimInvite(
  batchIdOrInviteId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log('[OwnerInvites] cancelCertificateClaimInvite started', { batchIdOrInviteId });

  try {
    const trimmed = batchIdOrInviteId?.trim();
    if (!trimmed) {
      return { success: false, error: 'Invalid invite ID' };
    }

    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in' };
    }

    const adminClient = getSupabaseServerAdminClient();

    // Try batch_id first
    const { data: byBatch } = await asUntyped(adminClient)
      .from('certificate_claim_invites')
      .select('id, status, source_artwork_id, created_by')
      .eq('batch_id', trimmed)
      .eq('created_by', user.id);

    let rows = byBatch as Array<Record<string, unknown>> | null;

    // Fall back to direct invite id
    if (!rows?.length) {
      const { data: one } = await asUntyped(adminClient)
        .from('certificate_claim_invites')
        .select('id, status, source_artwork_id, created_by')
        .eq('id', trimmed)
        .eq('created_by', user.id)
        .maybeSingle();

      rows = one ? [one as Record<string, unknown>] : null;
    }

    if (!rows?.length) {
      return { success: false, error: 'Invite not found or you do not have permission to revoke it' };
    }

    const hasConsumed = rows.some((r) => r.status === 'consumed');
    if (hasConsumed) {
      return {
        success: false,
        error: 'This certificate was already accepted and cannot be revoked',
      };
    }

    const cancellableIds = rows
      .filter((r) => r.status === 'sent' || r.status === 'pending')
      .map((r) => r.id as string);

    if (cancellableIds.length === 0) {
      return { success: true }; // Already cancelled/expired — idempotent
    }

    const { error: updateError } = await asUntyped(adminClient)
      .from('certificate_claim_invites')
      .update({ status: 'cancelled' })
      .in('id', cancellableIds);

    if (updateError) {
      console.error('[OwnerInvites] cancelCertificateClaimInvite update failed', updateError);
      logger.error('cancel_certificate_claim_invite_failed', { error: updateError });
      return { success: false, error: 'Could not revoke the invite' };
    }

    // Revalidate all affected certificate pages
    const sourceIds = [...new Set(rows.map((r) => r.source_artwork_id as string))];
    for (const sid of sourceIds) {
      revalidatePath(`/artworks/${sid}/certificate`);
    }
    revalidatePath('/portal/sent-invites');

    console.log('[OwnerInvites] cancelCertificateClaimInvite succeeded', {
      cancelled: cancellableIds.length,
    });
    return { success: true };
  } catch (err) {
    console.error('[OwnerInvites] cancelCertificateClaimInvite failed', err);
    logger.error('cancel_certificate_claim_invite_exception', { error: err });
    return { success: false, error: err instanceof Error ? err.message : 'Revoke failed' };
  }
}
