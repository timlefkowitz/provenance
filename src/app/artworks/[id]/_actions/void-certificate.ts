'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { asUntyped } from '~/lib/supabase-untyped';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';

export type VoidCertificateResult = { success: true } | { success: false; error: string };

const MAX_REASON_LENGTH = 500;

async function loadEditableArtwork(artworkId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'You must be signed in.' } as const;

  // Admin read: RLS hides gallery-held certificates from some team members.
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: artwork, error } = await admin
    .from('artworks')
    .select('id, account_id, gallery_profile_id, status, status_before_void')
    .eq('id', artworkId)
    .maybeSingle();

  if (error || !artwork) return { error: 'Certificate not found.' } as const;

  const canEdit = await canEditGalleryArtworks(user.id, {
    account_id: artwork.account_id,
    gallery_profile_id: artwork.gallery_profile_id ?? undefined,
  });
  if (!canEdit) return { error: 'Only the certificate holder can do this.' } as const;

  return { user, admin, artwork } as const;
}

function revalidateCertificatePaths(artworkId: string) {
  revalidatePath('/artworks');
  revalidatePath('/artworks/my');
  revalidatePath('/artworks/archive');
  revalidatePath(`/artworks/${artworkId}/certificate`);
  revalidatePath('/registry');
}

/**
 * Void a certificate. It drops out of collections, the registry and public
 * pages, and moves to the holder's Archive. Its page still resolves so a
 * scanned QR code shows that it is void.
 */
export async function voidCertificate(
  artworkId: string,
  reason?: string | null,
): Promise<VoidCertificateResult> {
  const loaded = await loadEditableArtwork(artworkId);
  if ('error' in loaded) return { success: false, error: loaded.error as string };
  const { user, admin, artwork } = loaded;

  if (artwork.status === 'voided') {
    return { success: false, error: 'This certificate is already void.' };
  }

  const trimmedReason = reason?.trim().slice(0, MAX_REASON_LENGTH) || null;

  const { error } = await admin
    .from('artworks')
    .update({
      status: 'voided',
      status_before_void: artwork.status ?? 'verified',
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: trimmedReason,
    })
    .eq('id', artworkId);

  if (error) {
    console.error('[Certificate] voidCertificate failed', { artworkId, error });
    return { success: false, error: 'Could not void the certificate. Please try again.' };
  }

  console.log('[Certificate] voided', { artworkId, by: user.id });
  revalidateCertificatePaths(artworkId);
  return { success: true };
}

/** Restore a voided certificate from the Archive to its previous status. */
export async function restoreCertificate(artworkId: string): Promise<VoidCertificateResult> {
  const loaded = await loadEditableArtwork(artworkId);
  if ('error' in loaded) return { success: false, error: loaded.error as string };
  const { user, admin, artwork } = loaded;

  if (artwork.status !== 'voided') {
    return { success: false, error: 'This certificate is not void.' };
  }

  const { error } = await admin
    .from('artworks')
    .update({
      status: artwork.status_before_void || 'verified',
      status_before_void: null,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    })
    .eq('id', artworkId);

  if (error) {
    console.error('[Certificate] restoreCertificate failed', { artworkId, error });
    return { success: false, error: 'Could not restore the certificate. Please try again.' };
  }

  console.log('[Certificate] restored', { artworkId, by: user.id });
  revalidateCertificatePaths(artworkId);
  return { success: true };
}
