import { NextResponse, type NextRequest } from 'next/server';
import { constantTimeEquals } from '~/lib/security/constant-time';
import { payDueEarnings } from '~/lib/payouts/seller-payouts';

/**
 * Hourly: transfer released seller earnings (past the payout hold, seller has
 * payout details) to their connected accounts. Stripe then pays out daily to
 * the seller's bank. account.updated also triggers this per seller as soon as
 * payout details are finished.
 *
 * Auth: protected by CRON_SECRET (Authorization: Bearer ...).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[CRON/pay-sellers] CRON_SECRET is not set');
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
  console.log('[CRON/pay-sellers] started');
  const result = await payDueEarnings();
  return NextResponse.json({ ok: true, ...result });
}
