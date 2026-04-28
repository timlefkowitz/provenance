import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';

/**
 * POST /api/heartbeat
 * Lightweight presence ping. The client component <PresenceTracker />
 * fires this every 60 seconds while the tab is visible. The DB function
 * `record_user_heartbeat` debounces minute increments at the source so
 * tab-switching / multi-tab usage does not double-count time.
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

  // record_user_heartbeat is a custom RPC (see scripts/2026-04-27_feedback_and_presence.sql)
  // that is not yet present in the generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('record_user_heartbeat', {
    p_user_id: user.id,
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
