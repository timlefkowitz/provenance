'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { CERTIFICATE_TYPES, getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';
import { insertArtistCoaFromSourceCertificate } from '~/lib/certificate-claims/insert-linked-certificate';
import { logger } from '~/lib/logger';

import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Artist accepts a Certificate of Show a gallery/institution posted crediting
 * them (the "Claim" button on a certificate_claim_request notification).
 *
 * Creates the artist's linked Certificate of Authenticity, the same way the
 * emailed claim link does. The writes go through the service role: the source
 * certificate belongs to the gallery, so RLS would silently drop an update
 * made as the artist.
 */
export async function claimCertificate(artworkId: string) {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, name, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  if (userRole !== USER_ROLES.ARTIST) {
    throw new Error('Only artists can claim certificates');
  }

  const adminClient = asUntyped(getSupabaseServerAdminClient());

  const { data: artwork, error: artworkError } = await adminClient
    .from('artworks')
    .select('*')
    .eq('id', artworkId)
    .single();

  if (artworkError || !artwork) {
    throw new Error('Artwork not found');
  }

  // Only the artist the gallery credited can accept it.
  if (artwork.artist_account_id !== user.id) {
    throw new Error('This certificate was issued to a different artist');
  }

  const { data: existingCoa } = await adminClient
    .from('artworks')
    .select('id')
    .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
    .eq('artist_account_id', user.id)
    .eq('source_artwork_id', artworkId)
    .limit(1)
    .maybeSingle();

  if (existingCoa?.id) {
    return { success: true, artworkId: existingCoa.id as string };
  }

  if (artwork.certificate_status !== 'pending_artist_claim') {
    throw new Error('Certificate is not available for claiming');
  }

  console.log('[Certificates] claimCertificate creating COA', { artworkId });

  const { id: coaId } = await insertArtistCoaFromSourceCertificate(adminClient, artwork, {
    artistAccountId: user.id,
    createdByUserId: user.id,
  });

  try {
    await createNotification({
      userId: artwork.account_id,
      type: 'certificate_claimed',
      title: `Certificate claimed: ${artwork.title}`,
      message: `${account.name || 'The artist'} accepted the certificate for "${artwork.title}" and now holds the linked Certificate of Authenticity.`,
      artworkId: artwork.id,
      relatedUserId: user.id,
      metadata: { certificateNumber: artwork.certificate_number, coa_artwork_id: coaId },
    });
  } catch (notifError) {
    logger.error('claim_certificate_owner_notify_failed', { artworkId, error: notifError });
  }

  try {
    await createNotification({
      userId: user.id,
      type: 'certificate_verified',
      title: `Certificate of Authenticity ready: ${artwork.title}`,
      message: `Your Certificate of Authenticity for "${artwork.title}" is linked to this work.`,
      artworkId: coaId,
      relatedUserId: artwork.account_id,
      metadata: { source_artwork_id: artwork.id },
    });
  } catch (notifError) {
    logger.error('claim_certificate_artist_notify_failed', { artworkId, error: notifError });
  }

  revalidatePath(`/artworks/${artworkId}`);
  revalidatePath(`/artworks/${coaId}/certificate`);
  revalidatePath(`/artists/${user.id}`);
  revalidatePath('/portal');
  // Don't revalidate /notifications here - let the client handle the refresh
  // to avoid server component render errors

  return { success: true, artworkId: coaId };
}
