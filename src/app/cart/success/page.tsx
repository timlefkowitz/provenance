import Link from 'next/link';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { formatPrice } from '~/lib/cart/format';
import { asUntyped } from '~/lib/supabase-untyped';

import { ClearPurchasedFromCart } from './clear-purchased';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thank you | Provenance' };

export default async function CartSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const admin = asUntyped(getSupabaseServerAdminClient());

  // The session id is an unguessable Stripe id: it's what lets this page show the order.
  const { data: order } =
    sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)
      ? await admin
          .from('orders')
          .select('id, status, amount_total_cents, currency')
          .eq('checkout_session_id', sessionId)
          .maybeSingle()
      : { data: null };
  const { data: items } = order
    ? await admin.from('order_items').select('artwork_id, artwork_title, price_cents').eq('order_id', order.id)
    : { data: [] };
  const rows = (items ?? []) as Array<{ artwork_id: string | null; artwork_title: string | null; price_cents: number }>;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <ClearPurchasedFromCart artworkIds={rows.map((r) => r.artwork_id).filter((x): x is string => !!x)} />
        <h1 className="font-display text-3xl text-wine">Thank you</h1>
        {order ? (
          <>
            <p className="mt-3 font-serif text-ink/70">
              {order.status === 'paid'
                ? 'Your payment went through. The gallery will be in touch about delivery.'
                : 'We’re confirming your payment. This page will show it shortly; you’ll also get a receipt by email.'}
            </p>
            <ul className="mt-8 divide-y divide-wine/10 border-y border-wine/10">
              {rows.map((r) => (
                <li key={r.artwork_id ?? r.artwork_title} className="flex justify-between py-3 font-serif">
                  <span className="text-ink">{r.artwork_title ?? 'Untitled'}</span>
                  <span className="text-ink/70">{formatPrice(r.price_cents, order.currency as string)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-right font-serif text-ink">
              Total {formatPrice(order.amount_total_cents as number, order.currency as string)}
            </p>
          </>
        ) : (
          <p className="mt-3 font-serif text-ink/70">Your payment was received. You’ll get a receipt by email.</p>
        )}
        <Link href="/artworks" className="mt-10 inline-block font-serif text-sm text-wine hover:underline">
          Keep browsing
        </Link>
      </div>
    </div>
  );
}
