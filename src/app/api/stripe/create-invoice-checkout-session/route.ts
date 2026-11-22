import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { startCheckout } from '~/lib/cart/start-checkout';
import { isInvoiceExpired, loadInvoiceByToken, resolveInvoiceItems } from '~/lib/invoices/invoices';
import { getStripeClient } from '~/lib/payouts/seller-payouts';
import { asUntyped } from '~/lib/supabase-untyped';

const BodySchema = z.object({ token: z.string().min(20).max(64), app: z.boolean().optional() });

/** Pay a gallery's invoice: every work on it in one Stripe Checkout. */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invoice link.' }, { status: 400 });

  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });

  const admin = asUntyped(getSupabaseServerAdminClient());
  const loaded = await loadInvoiceByToken(admin, parsed.data.token);
  if (!loaded) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  const { invoice, items } = loaded;
  if (invoice.status === 'paid') return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 409 });
  if (invoice.status === 'cancelled' || isInvoiceExpired(invoice)) {
    return NextResponse.json({ error: 'This invoice is no longer open. Contact the gallery.' }, { status: 410 });
  }

  const resolved = await resolveInvoiceItems(admin, invoice, items);
  const unavailable = resolved.filter((r) => !r.available);
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error:
          unavailable.length === resolved.length
            ? 'These works are no longer available. Contact the gallery.'
            : 'Some works on this invoice are no longer available. Contact the gallery for an updated invoice.',
        unavailable: unavailable.map((u) => ({ artworkId: u.artworkId, reason: u.reason })),
      },
      { status: 409 },
    );
  }

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  console.log('[Invoices] checkout started', { invoiceId: invoice.id, works: resolved.length });
  const result = await startCheckout(admin, stripe, {
    items: resolved,
    user: user ? { id: user.id, email: user.email } : null,
    app: parsed.data.app,
    invoiceId: invoice.id,
    cancelPath: `/invoice/${invoice.token}`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, unavailable: result.unavailable, signIn: result.signIn },
      { status: result.status },
    );
  }
  return NextResponse.json({ url: result.url });
}
