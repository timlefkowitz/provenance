import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveCartItems } from '~/lib/cart/resolve-cart';
import { startCheckout } from '~/lib/cart/start-checkout';
import { getStripeClient } from '~/lib/payouts/seller-payouts';
import { asUntyped } from '~/lib/supabase-untyped';

const BodySchema = z.object({
  items: z
    .array(z.object({ artworkId: z.string().uuid(), exhibitionId: z.string().uuid().nullable() }))
    .min(1)
    .max(25),
  /** Bought from the iOS app: the thank-you page tells them to tap Done. */
  app: z.boolean().optional(),
});

/** Start one Stripe Checkout for a cart (or a single Buy now). */
export async function POST(req: NextRequest) {
  console.log('[Cart] create-cart-checkout-session started');
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Your cart is empty or invalid.' }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  const admin = asUntyped(getSupabaseServerAdminClient());

  const resolved = await resolveCartItems(admin, parsed.data.items);
  const unavailable = resolved.filter((r) => !r.available);
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: 'Some works in your cart are no longer available.',
        unavailable: unavailable.map((u) => ({ artworkId: u.artworkId, reason: u.reason })),
      },
      { status: 409 },
    );
  }

  const result = await startCheckout(admin, stripe, {
    items: resolved,
    user: user ? { id: user.id, email: user.email } : null,
    app: parsed.data.app,
    cancelPath: '/cart',
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, unavailable: result.unavailable, signIn: result.signIn },
      { status: result.status },
    );
  }
  return NextResponse.json({ url: result.url });
}
