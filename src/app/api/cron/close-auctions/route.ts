import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { finalizeOverdueLots } from '~/lib/auctions/finalize-lots';
import { constantTimeEquals } from '~/lib/security/constant-time';
import { asUntyped } from '~/lib/supabase-untyped';

export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/close-auctions] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  return constantTimeEquals(header.slice(7), secret);
}

/**
 * Settles auction lots whose time has run out: records the sale, sends the
 * winner their Certificate of Ownership invite, and closes finished auctions.
 * Auction pages also settle lots when visited; this catches the rest.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await finalizeOverdueLots(asUntyped(getSupabaseServerAdminClient()));
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
