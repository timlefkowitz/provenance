import { describe, expect, it } from 'vitest';

import {
  buildAcquisitionsReport,
  buildAnnualReport,
  buildInsuranceReport,
  reportToCsv,
  type AcquisitionRow,
} from './build-reports';
import { buildReportPdfBytes } from './report-pdf';

const acq = (over: Partial<AcquisitionRow>): AcquisitionRow => ({
  title: 'Work',
  acquisition_type: 'purchase',
  seller_name: '',
  acquisition_price_cents: null,
  currency: 'USD',
  acquisition_date: '2026-03-01',
  accession_number: null,
  fund_source: null,
  status: 'accessioned',
  legal_status: 'clear',
  provenance_notes: null,
  updated_at: '2026-03-01T00:00:00Z',
  ...over,
});

describe('buildInsuranceReport', () => {
  const report = buildInsuranceReport({
    accountName: 'Fl!ght',
    today: '2026-11-09',
    works: [
      { id: 'a', title: 'Covered' },
      { id: 'b', title: 'Short' },
      { id: 'c', title: 'Bare' },
      { id: 'd', title: 'Lapsed' },
    ],
    valueCents: new Map([
      ['a', 100000],
      ['b', 500000],
      ['c', 200000],
      ['d', 50000],
    ]),
    policies: [
      { artwork_id: 'a', title: 'Covered', insurer_name: 'Hiscox', policy_number: 'P1', coverage_amount_cents: 120000, policy_end_date: '2027-01-01', status: 'active', updated_at: '2026-01-01' },
      { artwork_id: 'b', title: 'Short', insurer_name: 'Hiscox', policy_number: 'P2', coverage_amount_cents: 300000, policy_end_date: null, status: 'active', updated_at: '2026-01-01' },
      { artwork_id: 'd', title: 'Lapsed', insurer_name: 'AXA', policy_number: 'P3', coverage_amount_cents: 50000, policy_end_date: '2026-01-01', status: 'active', updated_at: '2026-01-01' },
    ],
  });
  const figures = Object.fromEntries(report.sections[0]!.figures!);

  it('totals coverage and flags under-insured, uninsured and expired works', () => {
    expect(figures['Insured']).toBe('2');
    expect(figures['Total coverage']).toBe('$4,200');
    expect(figures['Coverage gap']).toBe('$2,000');
    expect(figures['Uninsured works']).toBe('1');
    expect(figures['Expired policies']).toBe('1');
    const flags = Object.fromEntries(report.sections[1]!.table!.rows.map((r) => [r[0], r[6]]));
    expect(flags).toEqual({ Short: 'Under-insured', Bare: 'Uninsured', Covered: '', Lapsed: 'Expired' });
  });
});

describe('buildAcquisitionsReport', () => {
  const report = buildAcquisitionsReport({
    accountName: 'Museum',
    year: 2026,
    rows: [
      acq({ title: 'Gift A', acquisition_type: 'gift', seller_name: 'The Ford Foundation' }),
      acq({ title: 'Gift B', acquisition_type: 'bequest', seller_name: 'The Ford Foundation' }),
      acq({ title: 'Bought', acquisition_price_cents: 250000, fund_source: 'Acquisitions Fund' }),
      acq({ title: 'Old', acquisition_date: '2019-01-01', status: 'deaccessioned', updated_at: '2026-05-01T00:00:00Z' }),
    ],
  });
  const section = (h: string) => report.sections.find((s) => s.heading === h)!;

  it('rolls up donors and funds for the year and records deaccessions', () => {
    expect(section('Register').table!.rows).toHaveLength(3);
    expect(section('Donors').table!.rows).toEqual([['The Ford Foundation', '2', 'Gift A; Gift B']]);
    expect(section('Purchase funds').table!.rows).toEqual([['Acquisitions Fund', '1', '$2,500']]);
    expect(section('Deaccession record').table!.rows.map((r) => r[0])).toEqual(['Old']);
  });
});

describe('annual report, CSV and PDF', () => {
  const report = buildAnnualReport({
    accountName: 'Fl!ght',
    year: 2026,
    shows: [
      { title: 'Outside Dogs', start_date: '2026-11-05', end_date: '2026-11-30', shownCount: 20, soldCount: 5, recordedCents: 0, estimatedCents: 600000, provenanceValueCents: 690000 },
    ],
    sales: { count: 14, recordedCents: 205000, estimatedCents: 799100, provenanceValueCents: 1100000, collectors: 12 },
    acquisitions: [acq({ title: 'Gift “A”', acquisition_type: 'gift', seller_name: 'Donor, Jr.' })],
    openLoans: [],
    insurance: { coverageCents: 0, valueCents: 0, underInsured: 0 },
  });

  it('summarises the year', () => {
    const f = Object.fromEntries(report.sections[0]!.figures!);
    expect(f['Works sold from shows']).toBe('5 (25%)');
    expect(f['Estimated at set value']).toBe('$7,991');
    expect(f['Gifts & bequests']).toBe('1');
  });

  it('quotes CSV cells with commas and quotes', () => {
    expect(reportToCsv(report)).toContain('"Donor, Jr."');
  });

  it('renders a PDF, including characters the standard fonts cannot encode', async () => {
    const bytes = await buildReportPdfBytes(report);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
