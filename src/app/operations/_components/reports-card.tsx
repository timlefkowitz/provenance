'use client';

import { useState } from 'react';

const REPORTS = [
  {
    kind: 'annual',
    title: 'Annual / board report',
    body: 'Exhibitions, sell-through, revenue (recorded and estimated), Provenance Value, acquisitions, loans and insurance for one year.',
    yearly: true,
  },
  {
    kind: 'insurance',
    title: 'Collection insurance',
    body: 'Coverage against current value for every work, with under-insured, uninsured and expired policies flagged.',
    yearly: false,
  },
  {
    kind: 'acquisitions',
    title: 'Acquisitions & gifts',
    body: 'Acquisitions register, donor credit lines for gifts and bequests, purchase funds and the deaccession record.',
    yearly: true,
  },
] as const;

/** Download links for the Operations reports (PDF and CSV). */
export function ReportsCard() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  return (
    <section className="mb-8 rounded-md border border-wine/15 bg-parchment/50 p-4" aria-labelledby="ops-reports">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ops-reports" className="font-display text-wine text-sm">
          Reports
        </h2>
        <label className="font-serif text-xs text-ink/60">
          Year{' '}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="ml-1 rounded border border-wine/20 bg-white px-2 py-1 text-xs"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {REPORTS.map((r) => {
          const q = r.yearly ? `&year=${year}` : '';
          return (
            <div key={r.kind} className="rounded border border-wine/10 bg-white/60 p-3">
              <p className="font-serif text-sm text-ink">{r.title}</p>
              <p className="mt-1 font-serif text-xs text-ink/60">{r.body}</p>
              <div className="mt-2 flex gap-3 font-serif text-xs">
                <a
                  href={`/api/operations/reports/${r.kind}?format=pdf${q}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-wine underline underline-offset-2"
                >
                  PDF
                </a>
                <a href={`/api/operations/reports/${r.kind}?format=csv${q}`} className="text-wine underline underline-offset-2">
                  CSV
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
