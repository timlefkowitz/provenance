import { NextResponse, type NextRequest } from 'next/server';

import { constantTimeEquals } from '~/lib/security/constant-time';
import { refreshAllEntityStats } from '~/lib/stats/refresh-entity-stats';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Nightly recompute of entity_stats (the /portal/sales tiles, valuation
 * inputs). Sales and exhibition changes refresh the accounts they touch; this
 * catches everything else so no account is left with stale or missing stats.
 *
 * Auth: protected by CRON_SECRET (Authorization: Bearer ...).
 */
function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/refresh-entity-stats] CRON_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  return constantTimeEquals(header.slice(7), secret);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await refreshAllEntityStats();
  console.log('[CRON/refresh-entity-stats] done', result);
  return NextResponse.json(result);
}
