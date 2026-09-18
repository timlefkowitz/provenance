'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { logger } from '~/lib/logger';

type Level = 'info' | 'warn' | 'error';

/**
 * Lets the native app's IAP flow write to Vercel logs. Device console output
 * never leaves the phone, so without this a stuck purchase is invisible.
 * Search Vercel logs for `iap_client_`.
 */
export async function logIapEvent(
  level: Level,
  event: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    if (!/^[a-z0-9_]{1,60}$/.test(event)) return;

    const {
      data: { user },
    } = await getSupabaseServerClient().auth.getUser();
    if (!user) return;

    // Primitives only, truncated — this is client-supplied.
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data).slice(0, 20)) {
      if (typeof value === 'string') safe[key] = value.slice(0, 500);
      else if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    }

    logger[level](`iap_client_${event}`, { userId: user.id, ...safe });
  } catch {
    // Logging must never affect the purchase flow.
  }
}
