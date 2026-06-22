import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';

/**
 * POST /api/heartbeat
 * Lightweight presence ping. The client component <PresenceTracker />
 * fires this every 60 seconds while the tab is visible. The DB function
 * `record_user_heartbeat` debounces minute increments at the source so
 * tab-switching / multi-tab usage does not double-count time.
 *
 * Body (JSON, optional fields):
 *   { path?: string }   – normalized route path for page_activity analytics
 *
 * User-Agent is parsed server-side to derive device + browser for session analytics.
 */
export async function POST(req: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Cap any one user to 240 pings/minute (4x normal cadence) — prevents
  // a misbehaving / hostile client from inflating its own active time.
  const ok = checkRateLimit(req, {
    keyPrefix: `heartbeat:${user.id}`,
    maxPerWindow: 240,
    windowMs: 60_000,
  });
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429 },
    );
  }

  // Parse optional path from request body.
  let path: string | null = null;
  try {
    const body = (await req.json()) as { path?: unknown };
    if (typeof body?.path === 'string' && body.path.length > 0) {
      path = body.path.slice(0, 120);
    }
  } catch {
    // Body is optional; ignore parse errors.
  }

  // Derive device type and browser family from User-Agent without a dependency.
  const ua = req.headers.get('user-agent') ?? '';
  const device  = deriveDevice(ua);
  const browser = deriveBrowser(ua);

  console.log('[Heartbeat] recording', { userId: user.id, path, device, browser });

  // record_user_heartbeat is a custom RPC that is not yet present in the
  // generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('record_user_heartbeat', {
    p_user_id: user.id,
    p_path:    path,
    p_device:  device,
    p_browser: browser,
  });

  if (error) {
    console.error('[Heartbeat] record failed', error);
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    lastSeenAt: row?.last_seen_at ?? null,
    totalActiveMinutes: row?.total_active_minutes ?? 0,
  });
}

/** Returns "mobile" | "tablet" | "desktop" from a User-Agent string. */
function deriveDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (/mobile|android.+mobile|iphone|ipod|blackberry|windows phone/.test(s)) return 'mobile';
  if (/ipad|android(?!.*mobile)|tablet/.test(s)) return 'tablet';
  return 'desktop';
}

/** Returns the browser family name from a User-Agent string. */
function deriveBrowser(ua: string): string {
  // Order matters — more specific patterns first.
  if (/edg\//.test(ua))    return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome\//.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/msie|trident/i.test(ua)) return 'IE';
  return 'Other';
}
