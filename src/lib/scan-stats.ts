/**
 * Scan statistics for certificate QR codes (artworks and collectibles).
 *
 * Each recorded scan lives in `metadata.scan_locations` (the most recent
 * MAX_STORED_SCANS) with an optional anonymous `visitor` id and a `by_owner`
 * flag. `metadata.scan_stats.total` keeps counting past that cap.
 *
 * Everyone may see the totals; dates and places are for the owner and admins,
 * so pages strip `scan_locations` for other viewers (stripScanDetails).
 */

export type ScanStats = {
  /** Recorded scans, excluding the owner's own. */
  total: number;
  /** Distinct people among them (anonymous device ids; older scans count once each). */
  people: number;
  lastScannedAt: string | null;
};

export const EMPTY_SCAN_STATS: ScanStats = { total: 0, people: 0, lastScannedAt: null };

type StoredScan = { scanned_at?: unknown; visitor?: unknown; by_owner?: unknown };

/** Anonymous per-device id sent with a scan: 16–40 lowercase hex/alnum characters. */
export function isScanVisitorId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{16,40}$/.test(value);
}

function storedScans(metadata: unknown): StoredScan[] {
  const raw =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).scan_locations
      : undefined;
  return Array.isArray(raw) ? (raw.filter((s) => s && typeof s === 'object') as StoredScan[]) : [];
}

function storedTotal(metadata: unknown): number {
  const stats =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).scan_stats
      : undefined;
  const total = stats && typeof stats === 'object' ? (stats as Record<string, unknown>).total : undefined;
  return typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

export function computeScanStats(metadata: unknown): ScanStats {
  const scans = storedScans(metadata).filter((s) => s.by_owner !== true);
  const visitors = new Set<string>();
  let anonymous = 0;
  let last: string | null = null;
  for (const scan of scans) {
    if (isScanVisitorId(scan.visitor)) visitors.add(scan.visitor);
    else anonymous += 1;
    if (typeof scan.scanned_at === 'string' && (!last || scan.scanned_at > last)) last = scan.scanned_at;
  }
  const total = Math.max(storedTotal(metadata), scans.length);
  return { total, people: Math.min(total, visitors.size + anonymous), lastScannedAt: last };
}

/** The running total to store after recording one more scan. */
export function nextScanTotal(metadata: unknown, byOwner: boolean): number {
  const current = Math.max(storedTotal(metadata), storedScans(metadata).filter((s) => s.by_owner !== true).length);
  return byOwner ? current : current + 1;
}

/** Metadata without per-scan dates and places, for viewers who aren't the owner or an admin. */
export function stripScanDetails<T>(metadata: T): T {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const rest = { ...(metadata as Record<string, unknown>) };
  delete rest.scan_locations;
  return rest as T;
}

/** "Scanned 42 times by 31 people" — or null when there are no scans yet. */
export function formatScanStats(stats: ScanStats): string | null {
  if (stats.total <= 0) return null;
  const times = `${stats.total.toLocaleString('en-US')} ${stats.total === 1 ? 'time' : 'times'}`;
  const people = stats.people > 0 ? ` by ${stats.people.toLocaleString('en-US')} ${stats.people === 1 ? 'person' : 'people'}` : '';
  return `Scanned ${times}${people}`;
}
