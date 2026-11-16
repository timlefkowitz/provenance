import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ensurePayoutAccount } from '~/lib/payouts/seller-payouts';

/**
 * Opens the caller's shop: creates (or returns) the invisible payout account
 * we transfer their earnings to. No plan or Stripe sign-up required.
 */
export async function POST(_req: NextRequest) {
  console.log('[StripeConnect] create-account started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await ensurePayoutAccount(user.id, user.email ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ accountId: result.accountId });
  } catch (err) {
    console.error('[StripeConnect] create-account failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to open shop' },
      { status: 500 },
    );
  }
}
