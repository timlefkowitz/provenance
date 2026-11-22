'use client';

import { useState } from 'react';

import Link from 'next/link';

import type { ExhibitionInvoiceSummary } from '~/app/exhibitions/_actions/exhibition-invoices';
import { ExhibitionInvoiceList } from '~/app/exhibitions/_components/exhibition-invoice-form';

/**
 * Pay-by-link invoices: the buyer pays every work on the invoice online
 * (Apple Pay, Google Pay or card) and it books like any show sale. They are
 * made from a show's works, so starting one opens that show's Online sales.
 */
export function SaleInvoicesSection({
  invoices,
  exhibitions,
}: {
  invoices: ExhibitionInvoiceSummary[];
  exhibitions: Array<{ id: string; title: string }>;
}) {
  const [exhibitionId, setExhibitionId] = useState(exhibitions[0]?.id ?? '');
  const open = invoices.filter((i) => i.status === 'open');
  const paid = invoices.filter((i) => i.status === 'paid');
  const paidCents = paid.reduce((a, i) => a + i.totalCents, 0);

  return (
    <section className="space-y-4 rounded-md border border-wine/15 bg-parchment/40 p-4">
      <div>
        <h3 className="font-display text-lg text-wine">Pay-by-link invoices</h3>
        <p className="max-w-3xl font-serif text-sm text-ink/70">
          Pick works from one of your shows and send the buyer a private link. They pay online with Apple Pay,
          Google Pay or card, no account needed; the works are marked sold, the artist’s share and your commission
          are booked, and the buyer gets each Certificate of Ownership.
          {invoices.length > 0 &&
            ` ${open.length} open · ${paid.length} paid (${new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(paidCents / 100)}).`}
        </p>
      </div>

      {exhibitions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exhibitionId}
            onChange={(e) => setExhibitionId(e.target.value)}
            aria-label="Show to invoice works from"
            className="h-9 max-w-xs rounded-md border border-wine/20 bg-bone px-2 font-serif text-sm"
          >
            {exhibitions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
          <Link
            href={`/exhibitions/${exhibitionId}/edit#online-sales`}
            className="inline-flex h-9 items-center rounded-md bg-wine px-4 font-serif text-sm text-parchment hover:bg-wine/90"
          >
            Choose works to invoice
          </Link>
        </div>
      ) : (
        <p className="font-serif text-sm text-ink/55">
          Create an exhibition with your works to send pay-by-link invoices.
        </p>
      )}

      {invoices.length > 0 ? (
        <ExhibitionInvoiceList invoices={invoices} showExhibition title="Sent invoices" />
      ) : (
        <p className="font-serif text-sm text-ink/55">No pay-by-link invoices yet.</p>
      )}
    </section>
  );
}
