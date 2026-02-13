'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';

export type VerifyCertificateResult = { success: true } | { success: false; error: string };

/**
 * Collector or gallery verifies a certificate after artist has claimed it.
 * Returns a result object so the client always receives a serializable response (avoids "Failed to fetch").
 */
export async function verifyCertificate(artworkId: string): Promise<VerifyCertificateResult> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user is a collector or gallery
    const { data: account } = await client
      .from('accounts')
      .select('id, name, public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const userRole = getUserRole(account.public_data as Record<string, unknown>);
    if (userRole !== USER_ROLES.COLLECTOR && userRole !== USER_ROLES.GALLERY) {
      return { success: false, error: 'Only collectors and galleries can verify certificates' };
    }

    // Get artwork
    const { data: artwork, error: artworkError } = await client
      .from('artworks')
      .select('id, account_id, title, certificate_number, certificate_status, artist_account_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    // Check if user owns this artwork
    if (artwork.account_id !== user.id) {
      return { success: false, error: 'You can only verify certificates for your own artworks' };
    }

    // Check if certificate is in pending_verification status
    if (artwork.certificate_status !== 'pending_verification') {
      return { success: false, error: 'Certificate is not ready for verification' };
    }

    // Update artwork with verification; once artist claimed and owner approved, it becomes Certificate of Authenticity
    const { error: updateError } = await client
      .from('artworks')
      .update({
        verified_by_owner_at: new Date().toISOString(),
        certificate_status: 'verified',
        certificate_type: 'authenticity',
      })
      .eq('id', artworkId);

    if (updateError) {
      return { success: false, error: `Failed to verify certificate: ${updateError.message}` };
    }

    // Create notification for the artist
    if (artwork.artist_account_id) {
      try {
        const artworkTitle = artwork.title || 'Untitled Artwork';
        const ownerName = account.name || 'The owner';
        await createNotification({
          userId: artwork.artist_account_id,
          type: 'certificate_verified',
          title: `Certificate Verified: ${artworkTitle}`,
          message: `${ownerName} has verified the certificate for "${artworkTitle}".`,
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

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify certificate';
    console.error('verifyCertificate error:', err);
    return { success: false, error: message };
  }
}
