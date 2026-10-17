import 'server-only';

import { createSign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { unstable_cache } from 'next/cache';

/**
 * App Store Connect API client for Sales and Trends reports (app downloads).
 *
 * Requires these env vars (App Store Connect → Users and Access → Integrations
 * → App Store Connect API, a Team Key with the "Sales" or "Finance" role):
 *   ASC_ISSUER_ID      — Issuer ID shown above the keys table
 *   ASC_KEY_ID         — the key's Key ID
 *   ASC_PRIVATE_KEY    — contents of the AuthKey_<KeyID>.p8 file
 *                        (literal "\n" sequences are accepted)
 *   ASC_VENDOR_NUMBER  — Payments and Financial Reports → vendor number (top left)
 * Optional: APPLE_APP_ID limits counts to this app when the account has several.
 */

type AscConfig = { issuerId: string; keyId: string; privateKey: string; vendorNumber: string };

export function getAscConfig(): AscConfig | null {
  const issuerId = process.env.ASC_ISSUER_ID?.trim();
  const keyId = process.env.ASC_KEY_ID?.trim();
  const privateKey = process.env.ASC_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const vendorNumber = process.env.ASC_VENDOR_NUMBER?.trim();
  if (!issuerId || !keyId || !privateKey || !vendorNumber) return null;
  return { issuerId, keyId, privateKey, vendorNumber };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** App Store Connect tokens may live at most 20 minutes. */
function buildAscJwt(config: AscConfig, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: config.issuerId,
      iat: nowSeconds,
      exp: nowSeconds + 15 * 60,
      aud: 'appstoreconnect-v1',
    }),
  );
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${base64url(signature)}`;
}

// Product Type Identifiers from Apple's Sales and Trends reference. In-app
// purchases (IA*) are left out.
const FIRST_TIME = new Set(['1', '1F', '1T', '1E', '1EP', '1EU', 'F1']);
const REDOWNLOAD = new Set(['3', '3F', '3T', 'F3']);
const UPDATE = new Set(['7', '7F', '7T', 'F7']);

export type DownloadSummary = {
  downloads: number;
  redownloads: number;
  updates: number;
  countries: Record<string, number>;
};

export function emptySummary(): DownloadSummary {
  return { downloads: 0, redownloads: 0, updates: 0, countries: {} };
}

/** Parses a SALES / SUMMARY report (tab-separated, header row first). */
export function parseSalesReport(tsv: string, appleId?: string): DownloadSummary {
  const summary = emptySummary();
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift()?.split('\t') ?? [];
  const col = (name: string) => header.indexOf(name);
  const typeIdx = col('Product Type Identifier');
  const unitsIdx = col('Units');
  const countryIdx = col('Country Code');
  const appIdx = col('Apple Identifier');
  if (typeIdx < 0 || unitsIdx < 0) return summary;

  for (const line of lines) {
    const cells = line.split('\t');
    if (appleId && appIdx >= 0 && cells[appIdx]?.trim() !== appleId) continue;
    const type = cells[typeIdx]?.trim() ?? '';
    const units = Number(cells[unitsIdx]) || 0;
    if (FIRST_TIME.has(type)) {
      summary.downloads += units;
      const country = cells[countryIdx]?.trim() || '??';
      summary.countries[country] = (summary.countries[country] ?? 0) + units;
    } else if (REDOWNLOAD.has(type)) {
      summary.redownloads += units;
    } else if (UPDATE.has(type)) {
      summary.updates += units;
    }
  }
  return summary;
}

type Frequency = 'DAILY' | 'MONTHLY';

/**
 * Fetches one report. Returns null when Apple has no report for that period
 * (not published yet, or no activity at all — both come back as 404).
 */
async function fetchSalesReport(
  frequency: Frequency,
  reportDate: string,
): Promise<DownloadSummary | null> {
  const config = getAscConfig();
  if (!config) throw new Error('App Store Connect API is not configured');

  const params = new URLSearchParams({
    'filter[frequency]': frequency,
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': config.vendorNumber,
    'filter[reportDate]': reportDate,
    'filter[version]': '1_1',
  });
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, {
    headers: {
      Authorization: `Bearer ${buildAscJwt(config, Math.floor(Date.now() / 1000))}`,
      Accept: 'application/a-gzip',
    },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`App Store Connect ${res.status}: ${body.slice(0, 300)}`);
  }
  const tsv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  return parseSalesReport(tsv, process.env.APPLE_APP_ID?.trim() || undefined);
}

// Each report is fixed once published, so cache per period; 6h lets a
// not-yet-published (404) day pick up its report later the same day.
const getCachedSalesReport = unstable_cache(fetchSalesReport, ['asc-sales-report-v1'], {
  revalidate: 6 * 60 * 60,
});

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DownloadsOverview = {
  daily: { day: string; downloads: number; available: boolean }[];
  monthly: { month: string; downloads: number; available: boolean }[];
  last30: DownloadSummary;
  totalMonthly: number;
};

/**
 * Last `days` daily reports (ending yesterday, Pacific time is close enough —
 * Apple publishes a day's report the following morning) plus the last
 * `months` monthly reports.
 */
export async function loadDownloadsOverview(days = 30, months = 12): Promise<DownloadsOverview> {
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    dayKeys.push(isoDay(d));
  }
  const monthKeys: string[] = [];
  for (let i = months; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(isoDay(d).slice(0, 7));
  }

  const [dailyReports, monthlyReports] = await Promise.all([
    Promise.all(dayKeys.map((k) => getCachedSalesReport('DAILY', k))),
    Promise.all(monthKeys.map((k) => getCachedSalesReport('MONTHLY', k))),
  ]);

  const last30 = emptySummary();
  for (const r of dailyReports) {
    if (!r) continue;
    last30.downloads += r.downloads;
    last30.redownloads += r.redownloads;
    last30.updates += r.updates;
    for (const [c, n] of Object.entries(r.countries)) {
      last30.countries[c] = (last30.countries[c] ?? 0) + n;
    }
  }

  const monthly = monthKeys.map((month, i) => ({
    month,
    downloads: monthlyReports[i]?.downloads ?? 0,
    available: monthlyReports[i] !== null,
  }));

  return {
    daily: dayKeys.map((day, i) => ({
      day,
      downloads: dailyReports[i]?.downloads ?? 0,
      available: dailyReports[i] !== null,
    })),
    monthly,
    last30,
    totalMonthly: monthly.reduce((sum, m) => sum + m.downloads, 0),
  };
}
