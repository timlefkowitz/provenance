/**
 * QR scan analytics for a work in an exhibition, for the people behind the
 * show: its organisers (gallery, institution or curator and their team) and
 * the artists whose work hangs in it.
 *
 * A work can be scanned through more than one certificate: the artist's COA
 * and the Certificate of Show the show issued from it. Both certificates'
 * stored scans are combined. Scans by a certificate's owner are left out, as
 * on the certificate page.
 *
 * Privacy: these viewers don't hold the certificate, so they never get exact
 * coordinates, addresses, dates of single scans or device details — only
 * counts and city-level places, and places only for scans made during the
 * show (when the work was on the wall, not later in a collector's home).
 */

import { computeScanStats, isScanVisitorId } from './scan-stats';

type StoredScan = {
  scanned_at?: unknown;
  visitor?: unknown;
  by_owner?: unknown;
  city?: unknown;
  region?: unknown;
  country?: unknown;
  ip_city?: unknown;
  ip_region?: unknown;
  ip_country?: unknown;
};

export type ScanWindow = {
  /** ISO date or timestamp; scans on or after this count as during the show. */
  from: string | null;
  /** ISO date or timestamp; a bare date includes that whole day. Null: still running. */
  to: string | null;
};

export type ScanPlace = { label: string; count: number };

export type ExhibitionWorkScanStats = {
  /** All recorded scans of the work's certificates, ever (owners excluded). */
  allTime: number;
  /** Scans made during the show. */
  duringShow: number;
  /** Distinct people among the scans during the show. */
  peopleDuringShow: number;
  /** Most recent scan during the show. */
  lastScannedAt: string | null;
  /** City-level places of scans during the show, most first (at most 5). */
  places: ScanPlace[];
};

export const EMPTY_WORK_SCAN_STATS: ExhibitionWorkScanStats = {
  allTime: 0,
  duringShow: 0,
  peopleDuringShow: 0,
  lastScannedAt: null,
  places: [],
};

const MAX_PLACES = 5;

function storedScans(metadata: unknown): StoredScan[] {
  const raw =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).scan_locations
      : undefined;
  return Array.isArray(raw)
    ? (raw.filter((s) => s && typeof s === 'object') as StoredScan[])
    : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** "Chicago, IL, US" from the browser's place, else the network's; null when unknown. */
export function scanPlaceLabel(scan: StoredScan): string | null {
  const city = text(scan.city) ?? text(scan.ip_city);
  const region = text(scan.region) ?? text(scan.ip_region);
  const country = text(scan.country) ?? text(scan.ip_country);
  // Vercel URL-encodes city names ("S%C3%A3o%20Paulo").
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  if (!city) return country ? decode(country) : null;
  return [city, region, country].filter(Boolean).map((s) => decode(s as string)).join(', ');
}

function bound(value: string | null, endOfDay: boolean): number | null {
  if (!value) return null;
  const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = Date.parse(bareDate ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(ms)) return null;
  // A bare end date includes that day; allow a day either side for time zones.
  if (bareDate) return endOfDay ? ms + 2 * 86_400_000 : ms - 86_400_000;
  return ms;
}

export function inScanWindow(scannedAt: unknown, window: ScanWindow): boolean {
  if (typeof scannedAt !== 'string') return false;
  const t = Date.parse(scannedAt);
  if (!Number.isFinite(t)) return false;
  const from = bound(window.from, false);
  const to = bound(window.to, true);
  return (from === null || t >= from) && (to === null || t < to);
}

/**
 * Scan stats for one work in a show, from the metadata of each certificate
 * it can be scanned through (COA and/or Certificate of Show).
 */
export function computeExhibitionWorkScanStats(
  certificateMetadata: unknown[],
  window: ScanWindow,
): ExhibitionWorkScanStats {
  let allTime = 0;
  let duringShow = 0;
  let anonymous = 0;
  let last: string | null = null;
  const visitors = new Set<string>();
  const places = new Map<string, number>();

  for (const metadata of certificateMetadata) {
    allTime += computeScanStats(metadata).total;
    for (const scan of storedScans(metadata)) {
      if (scan.by_owner === true || !inScanWindow(scan.scanned_at, window)) continue;
      duringShow += 1;
      if (isScanVisitorId(scan.visitor)) visitors.add(scan.visitor);
      else anonymous += 1;
      const at = scan.scanned_at as string;
      if (!last || at > last) last = at;
      const place = scanPlaceLabel(scan);
      if (place) places.set(place, (places.get(place) ?? 0) + 1);
    }
  }

  return {
    allTime: Math.max(allTime, duringShow),
    duringShow,
    peopleDuringShow: Math.min(duringShow, visitors.size + anonymous),
    lastScannedAt: last,
    places: [...places.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_PLACES)
      .map(([label, count]) => ({ label, count })),
  };
}

/**
 * The show's window: its start date (or, without one, when the work joined
 * it) to its end date.
 */
export function exhibitionScanWindow(
  exhibition: { start_date: string | null; end_date: string | null },
  joinedAt?: string | null,
): ScanWindow {
  return { from: exhibition.start_date || joinedAt || null, to: exhibition.end_date || null };
}

export type PosterScanStats = {
  /** Scans of the show's QR code, team excluded. Flyers go out before the show opens, so every scan counts. */
  total: number;
  /** Distinct people among them. */
  people: number;
  lastScannedAt: string | null;
};

/** Stats for scans of the show's own QR code, from exhibition_poster_scans rows. */
export function computePosterScanStats(
  rows: Array<{ scanned_at: string; visitor: string | null }>,
): PosterScanStats {
  let anonymous = 0;
  let last: string | null = null;
  const visitors = new Set<string>();
  for (const row of rows) {
    if (isScanVisitorId(row.visitor)) visitors.add(row.visitor);
    else anonymous += 1;
    if (!last || row.scanned_at > last) last = row.scanned_at;
  }
  return { total: rows.length, people: Math.min(rows.length, visitors.size + anonymous), lastScannedAt: last };
}
