/**
 * Collectible value helpers.
 *
 * Collectibles use a simple declared free-text value (mirrors artworks.value)
 * rather than the full artwork_valuations engine. This keeps the "add a value,
 * see your collection total" flow working without coupling collectibles to the
 * art-specific valuation columns (forgery risk, artist market cap, etc.).
 */

/** Parse a free-text declared value like "$5,000" or "5000" or "5,000.50" into cents. */
export function parseDeclaredValueCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$€£¥\s]/g, '').replace(/,(?=\d{3}(?:[.,]|$))/g, '');
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const numeric = Number(match[0].replace(',', '.'));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) : 0;
}

/** Format cents as USD, e.g. 500000 -> "$5,000". */
export function formatMoneyCents(cents: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${Math.round(cents / 100).toLocaleString()}`;
  }
}

export interface CollectibleValueRow {
  value: string | null;
}

/** Sum the declared values (in cents) across a set of collectibles. */
export function sumCollectibleValueCents(rows: CollectibleValueRow[]): number {
  return rows.reduce((sum, row) => sum + parseDeclaredValueCents(row.value), 0);
}
