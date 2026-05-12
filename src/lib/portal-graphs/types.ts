export interface PortfolioPoint {
  /** ISO string for the first day of the month, e.g. "2025-06-01" */
  month: string;
  /** Sum of per-artwork value estimates at end of this month, in cents */
  value_cents: number;
  /** Lower bound (confidence or same as value when no formal valuation) */
  low_cents: number;
  /** Upper bound (confidence or same as value when no formal valuation) */
  high_cents: number;
}

export interface PortfolioSeries {
  /** Chronological monthly data points */
  series: PortfolioPoint[];
  /** Current total value in cents */
  total_cents: number;
  /** Current lower confidence bound */
  low_cents: number;
  /** Current upper confidence bound */
  high_cents: number;
  /** Number of artworks included in the snapshot */
  workCount: number;
  /** Number of artworks with a formal artwork_valuations row */
  valuationCoverage: number;
}

export function formatMoney(cents: number, currency = 'USD'): string {
  if (!cents) return `${currency} 0`;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString()}`;
  }
}

export function formatMoneyCompact(cents: number, currency = 'USD'): string {
  if (!cents) return `$0`;
  try {
    const value = cents / 100;
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${(cents / 100).toLocaleString()}`;
  }
}
