import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { setDigestOptOut, verifyUnsubscribeToken } from '~/lib/email-preferences';
import { asUntyped } from '~/lib/supabase-untyped';

export const runtime = 'nodejs';

/**
 * RFC 8058 one-click unsubscribe target, referenced by the digest's
 * List-Unsubscribe header. Mail clients POST here when the user presses
 * "Unsubscribe" in their inbox. Only POST changes state.
 */
export async function POST(request: NextRequest) {
  const userId = verifyUnsubscribeToken(request.nextUrl.searchParams.get('token'));
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const result = await setDigestOptOut(asUntyped(getSupabaseServerAdminClient()), userId, true);
  console.log('[Unsubscribe] one-click digest opt-out', { userId, ok: result.ok });
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Could not update preference' }, { status: 500 });
}
