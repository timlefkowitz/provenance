/**
 * Page view counts for certificates (COA, COO, COS) and exhibitions.
 *
 * Views are rows in `certificate_views` / `exhibition_views`, one per visit
 * (repeat visits by the same browser within VIEW_WINDOW_MS are collapsed
 * before insert). Views by the certificate's holder or the show's team are
 * stored but left out of every count. QR scans open the certificate page
 * too, so a scan is also a view.
 */

export type ViewStats = {
  total: number;
  /** Distinct browsers among them (views without an id count once each). */
  people: number;
  lastViewedAt: string | null;
};

export const EMPTY_VIEW_STATS: ViewStats = { total: 0, people: 0, lastViewedAt: null };

/** Repeat views of one page by one browser inside this window count once. */
export const VIEW_WINDOW_MS = 30 * 60 * 1000;

type Row = { visitor: string | null; viewed_at: string };

/** Stats from raw view rows, already filtered to the ones that count. */
export function computeViewStats(rows: Row[]): ViewStats {
  const visitors = new Set<string>();
  let anonymous = 0;
  let last: string | null = null;
  for (const row of rows) {
    if (row.visitor) visitors.add(row.visitor);
    else anonymous += 1;
    if (!last || row.viewed_at > last) last = row.viewed_at;
  }
  return { total: rows.length, people: visitors.size + anonymous, lastViewedAt: last };
}

/** Stats from a `certificate_view_stats` / `exhibition_view_stats` RPC row. */
export function viewStatsFromRpc(
  row: { total?: unknown; people?: unknown; last_viewed_at?: unknown } | null | undefined,
): ViewStats {
  if (!row) return EMPTY_VIEW_STATS;
  const num = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const total = num(row.total);
  return {
    total,
    people: Math.min(total, num(row.people)),
    lastViewedAt: typeof row.last_viewed_at === 'string' ? row.last_viewed_at : null,
  };
}

/** "Viewed 42 times by 31 people" — or null when there are no views yet. */
export function formatViewStats(stats: ViewStats): string | null {
  if (stats.total <= 0) return null;
  const times = `${stats.total.toLocaleString('en-US')} ${stats.total === 1 ? 'time' : 'times'}`;
  const people =
    stats.people > 0
      ? ` by ${stats.people.toLocaleString('en-US')} ${stats.people === 1 ? 'person' : 'people'}`
      : '';
  return `Viewed ${times}${people}`;
}

/** Crawlers, link unfurlers and headless browsers that shouldn't count as views. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|curl|wget|python-requests|axios|node-fetch/i.test(
    userAgent,
  );
}
