import { notFound } from 'next/navigation';

import { Image as ImageIcon } from 'lucide-react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { formatPrice, UNAVAILABLE_LABEL } from '~/lib/cart/format';
import { isInvoiceExpired, loadInvoiceByToken, resolveInvoiceItems } from '~/lib/invoices/invoices';
import { asUntyped } from '~/lib/supabase-untyped';

import { PayInvoiceButton } from './pay-invoice-button';

export const dynamic = 'force-dynamic';
// The link is private: keep it out of search engines and link previews.
export const metadata = { title: 'Invoice | Provenance', robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = asUntyped(getSupabaseServerAdminClient());
  const loaded = await loadInvoiceByToken(admin, token);
  if (!loaded) notFound();
  const { invoice, items } = loaded;

  const [{ data: exhibition }, { data: gallery }, resolved] = await Promise.all([
    admin.from('exhibitions').select('title, gallery_profile_id').eq('id', invoice.exhibition_id).maybeSingle(),
    admin.from('accounts').select('name').eq('id', invoice.gallery_account_id).maybeSingle(),
    resolveInvoiceItems(admin, invoice, items),
  ]);
  let galleryName = (gallery?.name as string | null) ?? 'The gallery';
  if (exhibition?.gallery_profile_id) {
    const { data: venue } = await admin
      .from('user_profiles')
      .select('name')
      .eq('id', exhibition.gallery_profile_id)
      .maybeSingle();
    if (venue?.name) galleryName = venue.name as string;
  }

  const total = resolved.reduce((a, i) => a + i.priceCents, 0);
  const unavailable = resolved.filter((r) => !r.available);
  const closed = invoice.status !== 'open' || isInvoiceExpired(invoice);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <p className="font-serif text-[11px] uppercase tracking-widest text-wine/60">Invoice</p>
        <h1 className="mt-2 font-display text-3xl text-wine">{galleryName}</h1>
        {exhibition?.title && <p className="mt-1 font-serif text-ink/60">{exhibition.title as string}</p>}
        {invoice.buyer_name && <p className="mt-4 font-serif text-sm text-ink/70">For {invoice.buyer_name}</p>}
        {invoice.note && (
          <p className="mt-4 whitespace-pre-line rounded-lg bg-parchment/60 px-4 py-3 font-serif text-sm text-ink/75">
            {invoice.note}
          </p>
        )}

        <ul className="mt-8 divide-y divide-wine/10 border-y border-wine/10">
          {resolved.map((item) => (
            <li key={item.artworkId} className="flex gap-4 py-4">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="h-20 w-20 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-wine/5">
                  <ImageIcon className="h-5 w-5 text-wine/25" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-serif font-semibold text-ink">{item.title}</p>
                {item.artistName && <p className="font-serif text-sm text-ink/65">{item.artistName}</p>}
                {!item.available && invoice.status === 'open' && item.reason && (
                  <p className="mt-1 font-serif text-xs text-vermillion">{UNAVAILABLE_LABEL[item.reason]}</p>
                )}
              </div>
              <span className="font-serif text-ink">{formatPrice(item.priceCents, item.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between font-serif">
          <span className="text-ink/60">Total</span>
          <span className="text-2xl text-ink">{formatPrice(total, invoice.currency)}</span>
        </div>

        <div className="mt-8">
          {invoice.status === 'paid' ? (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 font-serif text-sm text-emerald-900">
              Paid. Thank you! {galleryName} will be in touch about delivery.
            </p>
          ) : closed ? (
            <p className="rounded-lg bg-parchment/60 px-4 py-3 font-serif text-sm text-ink/70">
              This invoice is no longer open. Contact {galleryName} for a new one.
            </p>
          ) : unavailable.length > 0 ? (
            <p className="rounded-lg bg-parchment/60 px-4 py-3 font-serif text-sm text-ink/70">
              Some works here are no longer available. Contact {galleryName} for an updated invoice.
            </p>
          ) : (
            <>
              <PayInvoiceButton token={invoice.token} />
              <p className="mt-3 text-center font-serif text-xs text-ink/50">
                Apple Pay, Google Pay or card on Stripe’s secure checkout. No account needed; you’ll receive each
                work’s Certificate of Ownership by email.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
