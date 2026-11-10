/**
 * Institution / gallery reports built from Operations data: a generic report
 * shape (sections of key figures and tables) that renders to PDF or CSV.
 * Everything here is pure; loaders fetch the rows.
 */

export interface ReportTable {
  columns: string[];
  rows: string[][];
}

export interface ReportSection {
  heading: string;
  figures?: Array<[label: string, value: string]>;
  table?: ReportTable;
  note?: string;
}

export interface Report {
  title: string;
  subtitle: string;
  sections: ReportSection[];
}

export function money(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString('en-US')}`;
  }
}

const date = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
const sum = (xs: Array<number | null | undefined>) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

// ---------------------------------------------------------------- insurance

export interface InsuranceRow {
  artwork_id: string;
  title: string;
  insurer_name: string;
  policy_number: string | null;
  coverage_amount_cents: number | null;
  policy_end_date: string | null;
  status: string;
  updated_at: string;
}

/** Collection insurance: latest policy per work against its value, under-insured flagged. */
export function buildInsuranceReport(params: {
  accountName: string;
  policies: InsuranceRow[];
  /** Current value per artwork (valuation, sale price or set value). */
  valueCents: Map<string, number>;
  /** Every work in the collection, so uninsured works show too. */
  works: Array<{ id: string; title: string }>;
  today?: string;
}): Report {
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const latest = new Map<string, InsuranceRow>();
  for (const p of params.policies) {
    if (p.status === 'cancelled') continue;
    const prev = latest.get(p.artwork_id);
    if (!prev || p.updated_at > prev.updated_at) latest.set(p.artwork_id, p);
  }

  const rows = params.works.map((w) => {
    const p = latest.get(w.id);
    const value = params.valueCents.get(w.id) ?? 0;
    const cover = p?.coverage_amount_cents ?? 0;
    const expired = !!p?.policy_end_date && p.policy_end_date < today;
    const flag = !p ? 'Uninsured' : expired ? 'Expired' : value > 0 && cover < value ? 'Under-insured' : '';
    return { w, p, value, cover, flag };
  });
  rows.sort((a, b) => b.value - a.value);

  const insured = rows.filter((r) => r.p && r.flag !== 'Expired');
  const under = rows.filter((r) => r.flag === 'Under-insured');
  const gapCents = sum(under.map((r) => r.value - r.cover));

  return {
    title: 'Collection insurance',
    subtitle: `${params.accountName} · as of ${today}`,
    sections: [
      {
        heading: 'Summary',
        figures: [
          ['Works', String(rows.length)],
          ['Insured', String(insured.length)],
          ['Total coverage', money(sum(insured.map((r) => r.cover)))],
          ['Total value', money(sum(rows.map((r) => r.value)))],
          ['Under-insured works', String(under.length)],
          ['Coverage gap', money(gapCents)],
          ['Uninsured works', String(rows.filter((r) => r.flag === 'Uninsured').length)],
          ['Expired policies', String(rows.filter((r) => r.flag === 'Expired').length)],
        ],
        note: 'Value is the latest appraisal, else the recorded sale price, else the set value.',
      },
      {
        heading: 'Works',
        table: {
          columns: ['Work', 'Insurer', 'Policy', 'Coverage', 'Value', 'Ends', 'Flag'],
          rows: rows.map((r) => [
            r.w.title || 'Untitled',
            r.p?.insurer_name || '—',
            r.p?.policy_number || '—',
            r.p ? money(r.cover) : '—',
            r.value ? money(r.value) : '—',
            date(r.p?.policy_end_date),
            r.flag,
          ]),
        },
      },
    ],
  };
}

// ------------------------------------------------------------- acquisitions

export interface AcquisitionRow {
  title: string;
  acquisition_type: string;
  seller_name: string;
  acquisition_price_cents: number | null;
  currency: string;
  acquisition_date: string | null;
  accession_number: string | null;
  fund_source: string | null;
  status: string;
  legal_status: string;
  provenance_notes: string | null;
  updated_at: string;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Acquisitions register, donors (gifts and bequests), funds, and deaccessions. */
export function buildAcquisitionsReport(params: {
  accountName: string;
  rows: AcquisitionRow[];
  year?: number | null;
}): Report {
  const inYear = (r: AcquisitionRow) =>
    !params.year || (r.acquisition_date ?? '').startsWith(String(params.year));
  const rows = params.rows.filter(inYear).sort((a, b) => (a.acquisition_date ?? '').localeCompare(b.acquisition_date ?? ''));

  const byType = new Map<string, { count: number; cents: number }>();
  for (const r of rows) {
    const t = byType.get(r.acquisition_type) ?? { count: 0, cents: 0 };
    t.count += 1;
    t.cents += r.acquisition_price_cents ?? 0;
    byType.set(r.acquisition_type, t);
  }

  const donors = new Map<string, { gifts: number; titles: string[] }>();
  for (const r of rows.filter((x) => x.acquisition_type === 'gift' || x.acquisition_type === 'bequest')) {
    const name = r.seller_name.trim() || 'Anonymous';
    const d = donors.get(name) ?? { gifts: 0, titles: [] };
    d.gifts += 1;
    d.titles.push(r.title || 'Untitled');
    donors.set(name, d);
  }

  const funds = new Map<string, { count: number; cents: number }>();
  for (const r of rows.filter((x) => x.acquisition_type === 'purchase')) {
    const name = r.fund_source?.trim() || 'Unspecified';
    const f = funds.get(name) ?? { count: 0, cents: 0 };
    f.count += 1;
    f.cents += r.acquisition_price_cents ?? 0;
    funds.set(name, f);
  }

  const deaccessioned = params.rows.filter((r) => r.status === 'deaccessioned' && (!params.year || r.updated_at.startsWith(String(params.year))));

  return {
    title: 'Acquisitions & gifts',
    subtitle: `${params.accountName}${params.year ? ` · ${params.year}` : ' · all years'}`,
    sections: [
      {
        heading: 'Summary',
        figures: [
          ['Acquisitions', String(rows.length)],
          ...Array.from(byType, ([type, t]): [string, string] => [
            cap(type),
            `${t.count}${t.cents ? ` · ${money(t.cents)}` : ''}`,
          ]),
          ['Deaccessioned', String(deaccessioned.length)],
        ],
      },
      {
        heading: 'Register',
        table: {
          columns: ['Date', 'Accession no.', 'Work', 'Type', 'From', 'Price', 'Fund', 'Status'],
          rows: rows.map((r) => [
            date(r.acquisition_date),
            r.accession_number || '—',
            r.title || 'Untitled',
            cap(r.acquisition_type),
            r.seller_name || '—',
            r.acquisition_price_cents != null ? money(r.acquisition_price_cents, r.currency) : '—',
            r.fund_source || '—',
            cap(r.status.replace(/_/g, ' ')),
          ]),
        },
      },
      {
        heading: 'Donors',
        note: 'Gifts and bequests, for credit lines and acknowledgements.',
        table: {
          columns: ['Donor', 'Gifts', 'Works'],
          rows: Array.from(donors, ([name, d]) => [name, String(d.gifts), d.titles.join('; ')]).sort(
            (a, b) => Number(b[1]) - Number(a[1]),
          ),
        },
      },
      {
        heading: 'Purchase funds',
        table: {
          columns: ['Fund', 'Purchases', 'Spent'],
          rows: Array.from(funds, ([name, f]) => [name, String(f.count), money(f.cents)]).sort((a, b) =>
            a[0]!.localeCompare(b[0]!),
          ),
        },
      },
      {
        heading: 'Deaccession record',
        table: {
          columns: ['Work', 'Accession no.', 'Acquired', 'Legal status', 'Notes'],
          rows: deaccessioned.map((r) => [
            r.title || 'Untitled',
            r.accession_number || '—',
            date(r.acquisition_date),
            cap(r.legal_status.replace(/_/g, ' ')),
            r.provenance_notes || '—',
          ]),
        },
      },
    ],
  };
}

// ------------------------------------------------------------------- annual

export interface AnnualShowRow {
  title: string;
  start_date: string | null;
  end_date: string | null;
  shownCount: number;
  soldCount: number;
  recordedCents: number;
  estimatedCents: number;
  provenanceValueCents: number;
}

/** One-year summary for a board or annual report. */
export function buildAnnualReport(params: {
  accountName: string;
  year: number;
  shows: AnnualShowRow[];
  sales: { count: number; recordedCents: number; estimatedCents: number; provenanceValueCents: number; collectors: number };
  acquisitions: AcquisitionRow[];
  openLoans: Array<{ title: string; counterparty: string; start_date: string | null; end_date: string | null; status: string }>;
  insurance: { coverageCents: number; valueCents: number; underInsured: number };
}): Report {
  const y = String(params.year);
  const acq = params.acquisitions.filter((r) => (r.acquisition_date ?? '').startsWith(y));
  const deacc = params.acquisitions.filter((r) => r.status === 'deaccessioned' && r.updated_at.startsWith(y));
  const shown = sum(params.shows.map((s) => s.shownCount));
  const sold = sum(params.shows.map((s) => s.soldCount));

  return {
    title: `${params.year} annual report`,
    subtitle: params.accountName,
    sections: [
      {
        heading: 'Year at a glance',
        figures: [
          ['Exhibitions', String(params.shows.length)],
          ['Works shown', String(shown)],
          ['Works sold from shows', `${sold}${shown ? ` (${Math.round((sold / shown) * 100)}%)` : ''}`],
          ['All sales', String(params.sales.count)],
          ['Recorded revenue', money(params.sales.recordedCents)],
          ['Estimated at set value', money(params.sales.estimatedCents)],
          ['Provenance Value of works sold', money(params.sales.provenanceValueCents)],
          ['Collectors', String(params.sales.collectors)],
          ['Acquisitions', String(acq.length)],
          ['Gifts & bequests', String(acq.filter((r) => r.acquisition_type === 'gift' || r.acquisition_type === 'bequest').length)],
          ['Deaccessions', String(deacc.length)],
          ['Open loans', String(params.openLoans.length)],
          ['Insurance coverage', money(params.insurance.coverageCents)],
          ['Collection value', money(params.insurance.valueCents)],
          ['Under-insured works', String(params.insurance.underInsured)],
        ],
        note: 'Sales count once per work, wherever recorded (CoA, CoS or CoO). Unpriced sales are estimated at the set value.',
      },
      {
        heading: 'Exhibitions',
        table: {
          columns: ['Exhibition', 'Dates', 'Shown', 'Sold', 'Sell-through', 'Revenue', 'Provenance Value'],
          rows: params.shows.map((s) => [
            s.title,
            `${date(s.start_date)} – ${date(s.end_date)}`,
            String(s.shownCount),
            String(s.soldCount),
            s.shownCount ? `${Math.round((s.soldCount / s.shownCount) * 100)}%` : '—',
            `${money(s.recordedCents + s.estimatedCents)}${s.estimatedCents ? ' (incl. est.)' : ''}`,
            money(s.provenanceValueCents),
          ]),
        },
      },
      {
        heading: 'Acquisitions',
        table: {
          columns: ['Date', 'Work', 'Type', 'From', 'Price'],
          rows: acq.map((r) => [
            date(r.acquisition_date),
            r.title || 'Untitled',
            cap(r.acquisition_type),
            r.seller_name || '—',
            r.acquisition_price_cents != null ? money(r.acquisition_price_cents, r.currency) : '—',
          ]),
        },
      },
      {
        heading: 'Loans open at year end',
        table: {
          columns: ['Work', 'Counterparty', 'From', 'To', 'Status'],
          rows: params.openLoans.map((l) => [l.title || 'Untitled', l.counterparty || '—', date(l.start_date), date(l.end_date), cap(l.status)]),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------- csv

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Every section as CSV blocks: figures as label,value rows; tables with headers. */
export function reportToCsv(report: Report): string {
  const lines: string[] = [csvCell(report.title), csvCell(report.subtitle), ''];
  for (const s of report.sections) {
    lines.push(csvCell(s.heading));
    for (const [k, v] of s.figures ?? []) lines.push([k, v].map(csvCell).join(','));
    if (s.table) {
      lines.push(s.table.columns.map(csvCell).join(','));
      for (const row of s.table.rows) lines.push(row.map(csvCell).join(','));
    }
    lines.push('');
  }
  return lines.join('\n');
}
