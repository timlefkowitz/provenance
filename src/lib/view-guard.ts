import 'server-only';

import { checkRateLimit } from '~/lib/rate-limit';
import { isScanVisitorId } from '~/lib/scan-stats';
import { isLikelyBot, VIEW_WINDOW_MS } from '~/lib/view-stats';

/** One IP can't add more than this many views of one page per window (shared gallery Wi-Fi). */
const MAX_VIEWS_PER_IP_WINDOW = 40;

/**
 * Whether to record a view of `itemKey` (e.g. `artwork-<id>`). Anyone can
 * call the view actions without signing in, so: bots are skipped, a browser
 * counts once per VIEW_WINDOW_MS, and one IP is capped so a script can't
 * inflate a count. Browsers without an id fall back to one view per IP.
 */
export async function allowViewRecord(
  headers: Headers,
  itemKey: string,
  visitorId: string | null,
): Promise<boolean> {
  if (isLikelyBot(headers.get('user-agent'))) return false;

  if (!isScanVisitorId(visitorId)) {
    return checkRateLimit(
      { headers },
      { keyPrefix: `view-anon-${itemKey}`, windowMs: VIEW_WINDOW_MS, maxPerWindow: 1 },
    );
  }

  const ipOk = await checkRateLimit(
    { headers },
    { keyPrefix: `view-ip-${itemKey}`, windowMs: VIEW_WINDOW_MS, maxPerWindow: MAX_VIEWS_PER_IP_WINDOW },
  );
  if (!ipOk) return false;

  // A ':' in the prefix makes the key per-browser rather than per-IP.
  return checkRateLimit(
    { headers },
    { keyPrefix: `view-${itemKey}:${visitorId}`, windowMs: VIEW_WINDOW_MS, maxPerWindow: 1 },
  );
}
