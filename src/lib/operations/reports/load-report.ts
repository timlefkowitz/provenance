import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { attachProvenanceValues } from '~/lib/valuation/load-chain-provenance-values';

import { collectorKey } from '~/lib/collectors/group-collectors';
import { valueAt, type ArtworkValueRow, type ValuationRow } from '~/lib/portal-graphs/value-waterfall';
import { buildSalesBreakdown } from '~/lib/portal-graphs/sales-breakdown';
import { loadAccountSales } from '~/lib/sales/load-account-sales';
import { inChunks } from '~/lib/sales/load-chain-sales';

import {
  buildAcquisitionsReport,
  buildAnnualReport,
  buildInsuranceReport,
  type AcquisitionRow,
  type InsuranceRow,
  type Report,
} from './build-reports';

export type ReportKind = 'annual' | 'insurance' | 'acquisitions';
export const REPORT_KINDS: ReportKind[] = ['annual', 'insurance', 'acquisitions'];

/** Rows of an Operations table for this account; a missing table reads as empty. */
async function rowsFor<T>(admin: UntypedSupabaseClient, table: string, cols: string, accountId: string): Promise<T[]> {
  const { data, error } = await admin.from(table).select(cols).eq('account_id', accountId);
  if (error) {
    console.error('[Reports] fetch failed', { table, error: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

const titleOf = (a: unknown) => {
  const row = Array.isArray(a) ? a[0] : a;
  return ((row as { title?: string } | null)?.title ?? '') || 'Untitled';
};

async function accountName(admin: UntypedSupabaseClient, accountId: string): Promise<string> {
  const { data } = await admin.from('accounts').select('name').eq('id', accountId).maybeSingle();
  return (data?.name as string | null) || 'Your collection';
}

async function loadAcquisitions(admin: UntypedSupabaseClient, accountId: string): Promise<AcquisitionRow[]> {
  const rows = await rowsFor<Record<string, unknown>>(
    admin,
    'acquisitions',
    'acquisition_type, seller_name, acquisition_price_cents, currency, acquisition_date, accession_number, fund_source, status, legal_status, provenance_notes, updated_at, artwork:artworks(title)',
    accountId,
  );
  return rows.map((r) => ({ ...(r as unknown as AcquisitionRow), title: titleOf(r.artwork) }));
}

/** Collection insurance figures: latest policy per held work against its value today. */
async function loadInsurance(admin: UntypedSupabaseClient, accountId: string, name: string): Promise<Report> {
  const [policies, works] = await Promise.all([
    rowsFor<Record<string, unknown>>(
      admin,
      'insurance_valuations',
      'artwork_id, insurer_name, policy_number, coverage_amount_cents, policy_end_date, status, updated_at, artwork:artworks(title)',
      accountId,
    ),
    rowsFor<ArtworkValueRow & { title: string | null; certificate_type: string | null }>(
      admin,
      'artworks',
      'id, title, certificate_type, sold_price_cents, sold_at, value',
      accountId,
    ),
  ]);
  // Works the account holds; an artist's issued CoAs and a gallery's show copies count, sold-on CoOs don't exist here.
  const held = await attachProvenanceValues(admin, works);
  const valuations = await inChunks(
    held.map((w) => w.id),
    async (ids) => {
      const { data } = await admin
        .from('artwork_valuations')
        .select('artwork_id, generated_at, estimated_value_cents, confidence_low_cents, confidence_high_cents')
        .in('artwork_id', ids);
      return (data ?? []) as ValuationRow[];
    },
  );
  const byArtwork = new Map<string, ValuationRow[]>();
  for (const v of valuations) byArtwork.set(v.artwork_id, [...(byArtwork.get(v.artwork_id) ?? []), v]);
  const now = new Date();
  const valueCents = new Map(held.map((w) => [w.id, valueAt(w, byArtwork.get(w.id) ?? [], now).value_cents]));

  return buildInsuranceReport({
    accountName: name,
    policies: policies.map((p) => ({ ...(p as unknown as InsuranceRow), title: titleOf(p.artwork) })),
    valueCents,
    works: held.map((w) => ({ id: w.id, title: w.title ?? '' })),
  });
}

async function loadAnnual(admin: UntypedSupabaseClient, accountId: string, name: string, year: number): Promise<Report> {
  const y = String(year);
  const [accountSales, acquisitions, loans, insurance] = await Promise.all([
    loadAccountSales(admin, accountId),
    loadAcquisitions(admin, accountId),
    rowsFor<Record<string, unknown>>(
      admin,
      'artwork_loan_agreements',
      'borrower_name, lender_name, start_date, end_date, status, artwork:artworks(title)',
      accountId,
    ),
    loadInsurance(admin, accountId, name),
  ]);

  const yearSales = accountSales.sales.filter((s) => s.sold_at.startsWith(y));
  const breakdown = buildSalesBreakdown({ ...accountSales, sales: accountSales.sales });
  const showsInYear = new Set(accountSales.exhibitions.filter((e) => (e.start_date ?? '').startsWith(y)).map((e) => e.id));
  const yearTotals = buildSalesBreakdown({ ...accountSales, sales: yearSales, exhibitions: [] }).totals;

  const yearEnd = `${y}-12-31`;
  const openLoans = loans
    .filter(
      (l) =>
        ['sent', 'signed', 'active'].includes(String(l.status)) &&
        (!l.start_date || String(l.start_date) <= yearEnd) &&
        (!l.end_date || String(l.end_date) >= yearEnd),
    )
    .map((l) => ({
      title: titleOf(l.artwork),
      counterparty: String(l.borrower_name || l.lender_name || ''),
      start_date: (l.start_date as string | null) ?? null,
      end_date: (l.end_date as string | null) ?? null,
      status: String(l.status),
    }));

  const fig = Object.fromEntries(insurance.sections[0]?.figures ?? []);
  const cents = (label: string) => Math.round(Number(String(fig[label] ?? '0').replace(/[^0-9.]/g, '')) * 100) || 0;

  return buildAnnualReport({
    accountName: name,
    year,
    shows: breakdown.byExhibition
      .filter((r) => showsInYear.has(r.exhibitionId))
      .map((r) => {
        const ex = accountSales.exhibitions.find((e) => e.id === r.exhibitionId);
        return {
          title: r.title,
          start_date: r.startDate,
          end_date: ex?.end_date ?? null,
          shownCount: r.shownCount,
          soldCount: r.salesCount,
          recordedCents: r.recordedCents,
          estimatedCents: r.estimatedCents,
          provenanceValueCents: r.provenanceValueCents,
        };
      })
      .reverse(),
    sales: {
      count: yearTotals.salesCount,
      recordedCents: yearTotals.recordedCents,
      estimatedCents: yearTotals.estimatedCents,
      provenanceValueCents: yearTotals.provenanceValueCents,
      collectors: new Set(yearSales.map((s) => collectorKey(s)).filter(Boolean)).size,
    },
    acquisitions,
    openLoans,
    insurance: {
      coverageCents: cents('Total coverage'),
      valueCents: cents('Total value'),
      underInsured: Number(fig['Under-insured works'] ?? 0),
    },
  });
}

/** Builds one report for `accountId`. Callers check that the user may see it. */
export async function loadReport(
  admin: UntypedSupabaseClient,
  kind: ReportKind,
  accountId: string,
  year: number | null,
): Promise<Report> {
  const name = await accountName(admin, accountId);
  if (kind === 'insurance') return loadInsurance(admin, accountId, name);
  if (kind === 'acquisitions') {
    return buildAcquisitionsReport({ accountName: name, rows: await loadAcquisitions(admin, accountId), year });
  }
  return loadAnnual(admin, accountId, name, year ?? new Date().getFullYear());
}
