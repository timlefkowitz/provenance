'use server';

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
  const client = getSupabaseServerClient();

  // Get current artwork metadata
  const { data: artwork, error: fetchError } = await (client as any)
    .from('artworks')
    .select('metadata')
    .eq('id', artworkId)
    .single();

  if (fetchError || !artwork) {
    throw new Error('Artwork not found');
  }

  const currentMetadata = (artwork.metadata as Record<string, any>) || {};
  const scanLocations: ScanLocation[] = currentMetadata.scan_locations || [];

  // Add new scan location
  const newScan: ScanLocation = {
    ...location,
    scanned_at: new Date().toISOString(),
  };

  scanLocations.push(newScan);

  // Update artwork metadata
  const { error: updateError } = await (client as any)
    .from('artworks')
    .update({
      metadata: {
        ...currentMetadata,
        scan_locations: scanLocations,
      },
    })
    .eq('id', artworkId);

  if (updateError) {
    throw new Error(`Failed to record scan location: ${updateError.message}`);
  }

  // Get artwork owner to notify them
  const { data: artworkData } = await (client as any)
    .from('artworks')
    .select('account_id, title')
    .eq('id', artworkId)
    .single();

  // Create notification for artwork owner about QR scan
  if (artworkData?.account_id) {
    try {
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
      console.error('Error creating scan notification:', error);
    }
  }

  revalidatePath(`/artworks/${artworkId}/certificate`);
  revalidatePath('/portal');
  revalidatePath('/notifications');

  return { success: true };
}

