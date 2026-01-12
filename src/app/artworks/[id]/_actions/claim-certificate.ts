'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';

/**
 * Artist claims a certificate for an artwork posted by a collector/gallery
 */
export async function claimCertificate(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check if user is an artist
  const { data: account } = await client
    .from('accounts')
    .select('id, name, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.ARTIST) {
    throw new Error('Only artists can claim certificates');
  }

  // Get artwork
  const { data: artwork, error: artworkError } = await client
    .from('artworks')
    .select('id, account_id, title, certificate_number, certificate_status, artist_account_id')
    .eq('id', artworkId)
    .single();

  if (artworkError || !artwork) {
    throw new Error('Artwork not found');
  }

  // Check if certificate is in pending_artist_claim status
  if (artwork.certificate_status !== 'pending_artist_claim') {
    throw new Error('Certificate is not available for claiming');
  }

  // Update artwork with artist claim
  const { error: updateError } = await client
    .from('artworks')
    .update({
      artist_account_id: user.id,
      claimed_by_artist_at: new Date().toISOString(),
      certificate_status: 'pending_verification',
    })
    .eq('id', artworkId);

  if (updateError) {
    throw new Error(`Failed to claim certificate: ${updateError.message}`);
  }

  // Get owner account info for notification
  const { data: ownerAccount } = await client
    .from('accounts')
    .select('id, name')
    .eq('id', artwork.account_id)
    .single();

  // Create notification for the owner (collector/gallery)
  if (ownerAccount) {
    try {
      await createNotification({
        userId: artwork.account_id,
        type: 'certificate_claimed',
        title: `Certificate Claimed: ${artwork.title}`,
        message: `${account.name || 'An artist'} has claimed the certificate for "${artwork.title}". Please verify the claim.`,
        artworkId: artwork.id,
        relatedUserId: user.id,
        metadata: {
          certificateNumber: artwork.certificate_number,
        },
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the claim if notification fails
    }
  }

  revalidatePath(`/artworks/${artworkId}`);
  revalidatePath('/notifications');

  return { success: true };
}

