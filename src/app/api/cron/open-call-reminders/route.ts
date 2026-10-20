import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendOpenCallDeadlineReminders } from '~/lib/open-call-reminders';
import { constantTimeEquals } from '~/lib/security/constant-time';
import { asUntyped } from '~/lib/supabase-untyped';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/open-call-reminders] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  return constantTimeEquals(header.slice(7), secret);
}

/**
 * Daily job: reminds artists on an open call's list who haven't submitted
 * yet, in the days before the call closes.
 * Configure Vercel Cron to call with Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON/open-call-reminders] started');
  const result = await sendOpenCallDeadlineReminders(asUntyped(getSupabaseServerAdminClient()));
  console.log('[CRON/open-call-reminders] done', result);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
