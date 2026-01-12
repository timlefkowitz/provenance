'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';

/**
 * Collector or gallery verifies a certificate after artist has claimed it
 */
export async function verifyCertificate(artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check if user is a collector or gallery
  const { data: account } = await client
    .from('accounts')
    .select('id, name, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.COLLECTOR && userRole !== USER_ROLES.GALLERY) {
    throw new Error('Only collectors and galleries can verify certificates');
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

  // Check if user owns this artwork
  if (artwork.account_id !== user.id) {
    throw new Error('You can only verify certificates for your own artworks');
  }

  // Check if certificate is in pending_verification status
  if (artwork.certificate_status !== 'pending_verification') {
    throw new Error('Certificate is not ready for verification');
  }

  // Update artwork with verification
  const { error: updateError } = await client
    .from('artworks')
    .update({
      verified_by_owner_at: new Date().toISOString(),
      certificate_status: 'verified',
    })
    .eq('id', artworkId);

  if (updateError) {
    throw new Error(`Failed to verify certificate: ${updateError.message}`);
  }

  // Create notification for the artist
  if (artwork.artist_account_id) {
    try {
      await createNotification({
        userId: artwork.artist_account_id,
        type: 'certificate_verified',
        title: `Certificate Verified: ${artwork.title}`,
        message: `${account.name || 'The owner'} has verified the certificate for "${artwork.title}".`,
        artworkId: artwork.id,
        relatedUserId: user.id,
        metadata: {
          certificateNumber: artwork.certificate_number,
        },
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the verification if notification fails
    }
  }

  revalidatePath(`/artworks/${artworkId}`);
  revalidatePath('/notifications');

  return { success: true };
}

