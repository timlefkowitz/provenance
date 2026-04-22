'use client';

import Link from 'next/link';
import type { ConsignmentRow, LoanAgreementRow } from '../page';

type Props = {
  loans: LoanAgreementRow[];
  consignments: ConsignmentRow[];
};

function nextDate(dates: (string | null)[]) {
  const valid = dates.filter((d): d is string => Boolean(d)).sort();
  return valid[0] ?? null;
}

export function OperationsSummaryDashboard({ loans, consignments }: Props) {
  const activeLoans = loans.filter((l) => l.status === 'active' || l.status === 'signed');
  const attentionLoans = loans.filter(
    (l) => l.status === 'active' && l.end_date,
  );
  const attentionCons = consignments.filter(
    (c) => c.status === 'active' && c.end_date,
  );

  const loanEndDates = attentionLoans.map((l) => l.end_date);
  const consEndDates = attentionCons.map((c) => c.end_date);
  const nextLoanEnd = nextDate(loanEndDates);
  const nextConsEnd = nextDate(consEndDates);

  const overdueLoans = attentionLoans.filter((l) => l.end_date && l.end_date < new Date().toISOString().slice(0, 10));
  const overdueCons = attentionCons.filter(
    (c) => c.end_date && c.end_date < new Date().toISOString().slice(0, 10),
  );

  const consignedValue = consignments
    .filter((c) => c.status === 'active' && c.reserve_price_cents)
    .reduce((s, c) => s + (c.reserve_price_cents ?? 0), 0);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <div className="rounded-md border border-wine/15 bg-parchment/50 p-4">
        <p className="font-display text-wine text-sm">Active loans</p>
        <p className="text-2xl font-serif text-ink mt-1">{activeLoans.length}</p>
        {nextLoanEnd ? (
          <p className="text-xs text-ink/60 font-serif mt-1">
            Next end: {new Date(nextLoanEnd + 'T12:00:00').toLocaleDateString()}
          </p>
        ) : (
          <p className="text-xs text-ink/50 font-serif mt-1">No scheduled end dates</p>
        )}
      </div>
      <div className="rounded-md border border-wine/15 bg-parchment/50 p-4">
        <p className="font-display text-wine text-sm">Active consignments</p>
        <p className="text-2xl font-serif text-ink mt-1">
          {consignments.filter((c) => c.status === 'active').length}
        </p>
        {nextConsEnd ? (
          <p className="text-xs text-ink/60 font-serif mt-1">
            Next end: {new Date(nextConsEnd + 'T12:00:00').toLocaleDateString()}
          </p>
        ) : null}
        {consignedValue > 0 ? (
          <p className="text-xs text-ink/60 font-serif mt-1">Reserve total: {fmt.format(consignedValue / 100)}</p>
        ) : null}
      </div>
      <div className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:col-span-2 lg:col-span-2">
        <p className="font-display text-red-900/80 text-sm">Needs attention</p>
        {overdueLoans.length + overdueCons.length === 0 ? (
          <p className="text-sm text-ink/60 font-serif mt-2">No past-due end dates (active items).</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm font-serif">
            {overdueLoans.map((l) => (
              <li key={l.id}>
                <Link href="#loans" className="text-wine underline">
                  Loan
                </Link>
                {l.artwork ? ` — ${l.artwork.title}` : ''} (ended {l.end_date})
              </li>
            ))}
            {overdueCons.map((c) => (
              <li key={c.id}>
                <Link href="#consignments" className="text-wine underline">
                  Consignment
                </Link>
                {c.artwork ? ` — ${c.artwork.title}` : ''} (ended {c.end_date})
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink/50 font-serif mt-2">
          Daily alerts run via cron; set <code className="text-[11px]">CRON_SECRET</code> in production.
        </p>
      </div>
    </div>
  );
}
