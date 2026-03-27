'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';

export interface ScanLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;
  scanned_at: string;
}

/**
 * Record a QR code scan location for an artwork
 */
export async function recordScanLocation(
  artworkId: string,
  location: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
    formatted?: string;
  }
) {
  console.log('[CertificateScan] recordScanLocation started', { artworkId });

  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // Get current artwork metadata using admin client so anon scans can persist.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artwork, error: fetchError } = await (adminClient as any)
    .from('artworks')
    .select('metadata, account_id, title, status, is_public')
    .eq('id', artworkId)
    .single();

  if (fetchError || !artwork) {
    console.error('[CertificateScan] Artwork fetch failed', fetchError);
    throw new Error('Artwork not found');
  }

  // Security check: allow scans for public verified artworks, or by the artwork owner.
  const isPublicVerified = artwork.status === 'verified' && artwork.is_public === true;
  const isOwner = !!user && artwork.account_id === user.id;
  if (!isPublicVerified && !isOwner) {
    console.error('[CertificateScan] Scan write denied', {
      artworkId,
      userId: user?.id ?? null,
      status: artwork.status,
      is_public: artwork.is_public,
    });
    throw new Error('Not authorized to record scan location for this artwork');
  }

  const currentMetadata =
    (artwork.metadata as Record<string, unknown> | null) || {};
  const existingScanLocations = Array.isArray(currentMetadata['scan_locations'])
    ? (currentMetadata['scan_locations'] as ScanLocation[])
    : [];
  const scanLocations = [...existingScanLocations];

  // Add new scan location
  const newScan: ScanLocation = {
    ...location,
    scanned_at: new Date().toISOString(),
  };

  scanLocations.push(newScan);

  // Update artwork metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedRow, error: updateError } = await (adminClient as any)
    .from('artworks')
    .update({
      metadata: {
        ...currentMetadata,
        scan_locations: scanLocations,
      },
    })
    .eq('id', artworkId)
    .select('id')
    .single();

  if (updateError || !updatedRow) {
    console.error('[CertificateScan] Scan location update failed', updateError);
    throw new Error(
      `Failed to record scan location: ${updateError?.message ?? 'No row updated'}`,
    );
  }

  console.log('[CertificateScan] Scan location saved', {
    artworkId,
    totalScans: scanLocations.length,
    latitude: newScan.latitude,
    longitude: newScan.longitude,
  });

  // Get artwork owner to notify them
  const artworkData = {
    account_id: artwork.account_id as string | null,
    title: artwork.title as string | null,
  };

  // Create notification for artwork owner about QR scan
  if (artworkData?.account_id) {
    try {
      console.log('[CertificateScan] Creating owner notification', { artworkId });
      await createNotification({
        userId: artworkData.account_id,
        type: 'qr_code_scanned',
        title: 'QR Code Scanned',
        message: `Your artwork "${artworkData.title}" was scanned${location.formatted ? ` in ${location.formatted}` : ''}`,
        artworkId: artworkId,
        metadata: {
          scan_location: location,
          scan_type: 'qr_code',
        },
      });
    } catch (error) {
      // Don't fail the scan recording if notification fails
      console.error('[CertificateScan] Error creating scan notification', error);
    }
  }

  revalidatePath(`/artworks/${artworkId}/certificate`);
  revalidatePath('/portal');
  revalidatePath('/notifications');

  console.log('[CertificateScan] recordScanLocation completed', { artworkId });
  return { success: true };
}

