import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { checkRateLimit } from '~/lib/rate-limit';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Guards for the public QR-scan actions (artworks and collectibles). Anyone
 * can call them without signing in, so they need limits of their own: each
 * call writes to the item's metadata and can notify (and push to) its owner.
 */

/** Repeat scans of one item from one IP inside this window aren't recorded. */
const SCAN_WINDOW_MS = 10 * 60 * 1000;
const MAX_SCANS_PER_WINDOW = 3;

/** The owner gets at most one scan notification per item in this window. */
const NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

/** Only the newest scans are kept, so metadata can't grow without bound. */
export const MAX_STORED_SCANS = 500;

export type ScanGpsInput = {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;
};

/** False when this IP has already scanned this item a few times recently. */
export async function allowScanRecord(headers: Headers, itemKey: string): Promise<boolean> {
  // No ':' in the prefix, so checkRateLimit appends the client IP.
  return checkRateLimit(
    { headers },
    { keyPrefix: `scan-${itemKey}`, windowMs: SCAN_WINDOW_MS, maxPerWindow: MAX_SCANS_PER_WINDOW },
  );
}

function cleanPlace(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return cleaned || undefined;
}

/**
 * The GPS location comes from the scanner's browser, so treat it as untrusted:
 * drop it when the coordinates aren't real, and trim the place names that end
 * up in the owner's notification.
 */
export function sanitizeScanGps(gps: ScanGpsInput | null): ScanGpsInput | null {
  if (!gps) return null;
  const { latitude, longitude } = gps;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    city: cleanPlace(gps.city),
    region: cleanPlace(gps.region),
    country: cleanPlace(gps.country),
    formatted: cleanPlace(gps.formatted),
  };
}

/** True unless the owner already got a scan notification for this item recently. */
export async function scanNotificationDue(
  ownerId: string,
  item: { artworkId: string } | { collectibleId: string },
): Promise<boolean> {
  const since = new Date(Date.now() - NOTIFY_COOLDOWN_MS).toISOString();
  let query = asUntyped(getSupabaseServerAdminClient())
    .from('notifications')
    .select('id')
    .eq('user_id', ownerId)
    .eq('type', 'qr_code_scanned')
    .gte('created_at', since)
    .limit(1);
  query =
    'artworkId' in item
      ? query.eq('artwork_id', item.artworkId)
      : query.contains('metadata', { collectible_id: item.collectibleId });

  const { data, error } = await query;
  if (error) {
    console.error('[Scan] notification cooldown lookup failed', { ownerId, error });
    return true;
  }
  return !data?.length;
}
