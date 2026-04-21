'use server';

import { headers } from 'next/headers';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';

export interface ScanLocation {
  /** GPS coordinates — only present when user grants browser location permission */
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;

  /** IP-based location — captured server-side from Vercel edge headers */
  ip_city?: string;
  ip_region?: string;
  ip_country?: string;
  ip_latitude?: number;
  ip_longitude?: number;

  /** Device / browser context captured server-side */
  user_agent?: string;
  accept_language?: string;

  /** How precise the stored location is */
  location_source: 'gps' | 'ip' | 'none';

  scanned_at: string;
}

/**
 * Record a QR code scan event for an artwork.
 *
 * `gpsLocation` is optional — if the viewer denies the browser location prompt
 * (or it errors), callers pass `null` and we still record the scan with
 * server-side IP geolocation + device context so the owner knows it happened.
 */
export async function recordScanLocation(
  artworkId: string,
  gpsLocation: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
    formatted?: string;
  } | null,
) {
  console.log('[CertificateScan] recordScanLocation started', {
    artworkId,
    hasGps: !!gpsLocation,
  });

  const requestHeaders = await headers();

  // Vercel sets these headers at the edge with IP-based geolocation.
  // In local development they will be absent — that is fine.
  const ipCity = requestHeaders.get('x-vercel-ip-city') ?? undefined;
  const ipRegion = requestHeaders.get('x-vercel-ip-region') ?? undefined;
  const ipCountry = requestHeaders.get('x-vercel-ip-country') ?? undefined;
  const ipLatRaw = requestHeaders.get('x-vercel-ip-latitude');
  const ipLngRaw = requestHeaders.get('x-vercel-ip-longitude');
  const ipLatitude = ipLatRaw ? parseFloat(ipLatRaw) : undefined;
  const ipLongitude = ipLngRaw ? parseFloat(ipLngRaw) : undefined;
  const userAgent = requestHeaders.get('user-agent') ?? undefined;
  const acceptLanguage = requestHeaders.get('accept-language') ?? undefined;

  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();
  const {
    data: { user },
  } = await client.auth.getUser();

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

  const locationSource: ScanLocation['location_source'] = gpsLocation
    ? 'gps'
    : ipCity || ipCountry
      ? 'ip'
      : 'none';

  const newScan: ScanLocation = {
    // GPS fields — only set when permission was granted
    ...(gpsLocation ?? {}),
    // Server-side IP geolocation
    ip_city: ipCity,
    ip_region: ipRegion,
    ip_country: ipCountry,
    ip_latitude: Number.isFinite(ipLatitude) ? ipLatitude : undefined,
    ip_longitude: Number.isFinite(ipLongitude) ? ipLongitude : undefined,
    // Device context
    user_agent: userAgent,
    accept_language: acceptLanguage,
    location_source: locationSource,
    scanned_at: new Date().toISOString(),
  };

  const scanLocations = [...existingScanLocations, newScan];

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

  console.log('[CertificateScan] Scan saved', {
    artworkId,
    totalScans: scanLocations.length,
    locationSource,
    ipCountry,
    hasGps: !!gpsLocation,
  });

  // Notify artwork owner
  const artworkData = {
    account_id: artwork.account_id as string | null,
    title: artwork.title as string | null,
  };

  if (artworkData?.account_id) {
    try {
      const locationLabel =
        gpsLocation?.formatted ??
        (ipCity && ipCountry ? `${ipCity}, ${ipCountry}` : ipCountry) ??
        null;

      console.log('[CertificateScan] Creating owner notification', { artworkId });
      await createNotification({
        userId: artworkData.account_id,
        type: 'qr_code_scanned',
        title: 'QR Code Scanned',
        message: `Your artwork "${artworkData.title}" was scanned${locationLabel ? ` in ${locationLabel}` : ''}`,
        artworkId: artworkId,
        metadata: {
          scan_location: newScan,
          scan_type: 'qr_code',
          location_source: locationSource,
        },
      });
    } catch (error) {
      console.error('[CertificateScan] Error creating scan notification', error);
    }
  }

  revalidatePath(`/artworks/${artworkId}/certificate`);
  revalidatePath('/portal');
  revalidatePath('/notifications');

  console.log('[CertificateScan] recordScanLocation completed', { artworkId });
  return { success: true, scan: newScan };
}
