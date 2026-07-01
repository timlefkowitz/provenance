'use server';

import { headers } from 'next/headers';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';

export interface CollectibleScanLocation {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;

  ip_city?: string;
  ip_region?: string;
  ip_country?: string;
  ip_latitude?: number;
  ip_longitude?: number;

  user_agent?: string;
  accept_language?: string;

  location_source: 'gps' | 'ip' | 'none';
  scanned_at: string;
}

/**
 * Record a QR code scan for a collectible. Mirrors the artwork scan action:
 * appends to collectibles.metadata.scan_locations[] with GPS (when granted) or
 * server-side IP geolocation from Vercel edge headers, and notifies the owner.
 */
export async function recordCollectibleScanLocation(
  collectibleId: string,
  gpsLocation: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
    formatted?: string;
  } | null,
) {
  console.log('[Collectibles] recordCollectibleScanLocation started', {
    collectibleId,
    hasGps: !!gpsLocation,
  });

  const requestHeaders = await headers();
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

  const { data: collectible, error: fetchError } = await (adminClient as any)
    .from('collectibles')
    .select('metadata, account_id, title, status, is_public')
    .eq('id', collectibleId)
    .single();

  if (fetchError || !collectible) {
    console.error('[Collectibles] scan fetch failed', fetchError);
    throw new Error('Collectible not found');
  }

  const isPublicVerified = collectible.status === 'verified' && collectible.is_public === true;
  const isOwner = !!user && collectible.account_id === user.id;
  if (!isPublicVerified && !isOwner) {
    console.error('[Collectibles] scan write denied', {
      collectibleId,
      userId: user?.id ?? null,
    });
    throw new Error('Not authorized to record a scan for this collectible');
  }

  const currentMetadata = (collectible.metadata as Record<string, unknown> | null) || {};
  const existingScans = Array.isArray(currentMetadata['scan_locations'])
    ? (currentMetadata['scan_locations'] as CollectibleScanLocation[])
    : [];

  const locationSource: CollectibleScanLocation['location_source'] = gpsLocation
    ? 'gps'
    : ipCity || ipCountry
      ? 'ip'
      : 'none';

  const newScan: CollectibleScanLocation = {
    ...(gpsLocation ?? {}),
    ip_city: ipCity,
    ip_region: ipRegion,
    ip_country: ipCountry,
    ip_latitude: Number.isFinite(ipLatitude) ? ipLatitude : undefined,
    ip_longitude: Number.isFinite(ipLongitude) ? ipLongitude : undefined,
    user_agent: userAgent,
    accept_language: acceptLanguage,
    location_source: locationSource,
    scanned_at: new Date().toISOString(),
  };

  const scanLocations = [...existingScans, newScan];

  const { data: updatedRow, error: updateError } = await (adminClient as any)
    .from('collectibles')
    .update({
      metadata: { ...currentMetadata, scan_locations: scanLocations },
    })
    .eq('id', collectibleId)
    .select('id')
    .single();

  if (updateError || !updatedRow) {
    console.error('[Collectibles] scan update failed', updateError);
    throw new Error(`Failed to record scan: ${updateError?.message ?? 'no row updated'}`);
  }

  console.log('[Collectibles] scan saved', {
    collectibleId,
    totalScans: scanLocations.length,
    locationSource,
  });

  // Notify owner. Note: notifications.artwork_id has an FK to artworks, so we
  // must NOT set it for collectibles — the collectible id lives in metadata.
  if (collectible.account_id) {
    try {
      const locationLabel =
        gpsLocation?.formatted ??
        (ipCity && ipCountry ? `${ipCity}, ${ipCountry}` : ipCountry) ??
        null;
      await createNotification({
        userId: collectible.account_id as string,
        type: 'qr_code_scanned',
        title: 'QR Code Scanned',
        message: `Your collectible "${collectible.title}" was scanned${locationLabel ? ` in ${locationLabel}` : ''}`,
        metadata: {
          collectible_id: collectibleId,
          scan_location: newScan,
          scan_type: 'qr_code',
          location_source: locationSource,
        },
      });
    } catch (err) {
      console.error('[Collectibles] scan notification failed', err);
    }
  }

  revalidatePath(`/collectibles/${collectibleId}/certificate`);

  console.log('[Collectibles] recordCollectibleScanLocation completed', { collectibleId });
  return { success: true, scan: newScan };
}
