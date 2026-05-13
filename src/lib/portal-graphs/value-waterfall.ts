/**
 * Per-artwork value waterfall:
 *  1. Latest artwork_valuations.estimated_value_cents with generated_at <= t
 *  2. Else artworks.sold_price_cents (if sold_at <= t)
 *  3. Else parseInt(artworks.value) * 100 (declared free-text value)
 *  4. Else 0
 */

export interface ArtworkValueRow {
  id: string;
  sold_price_cents: number | null;
  sold_at: string | null;
  /** Free-text declared value from the artwork record */
  value: string | null;
}

export interface ValuationRow {
  artwork_id: string;
  generated_at: string;
  estimated_value_cents: number | null;
  confidence_low_cents: number | null;
  confidence_high_cents: number | null;
}

export type ValueSource = 'formal_valuation' | 'sale_price' | 'declared_value' | 'unknown';

export interface ValueResult {
  value_cents: number;
  low_cents: number;
  high_cents: number;
  /** true if step 1 (formal valuation) was used */
  fromValuation: boolean;
  /** Which step in the waterfall provided the value */
  source: ValueSource;
  /** Human-readable explanation of where this value came from */
  reasoning: string;
  details: {
    valuationGeneratedAt?: string;
    saleDate?: string;
    declaredValueRaw?: string | null;
  };
}

/** Parse a free-text declared value like "$5,000" or "5000" or "5,000.50" into cents */
function parseDeclaredValueCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  // Strip currency symbols, spaces, and thousands-separator commas before parsing
  const cleaned = raw.replace(/[$€£¥\s]/g, '').replace(/,(?=\d{3}(?:[.,]|$))/g, '');
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  // Normalise decimal separator to '.'
  const numeric = Number(match[0].replace(',', '.'));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) : 0;
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatMoneyCents(cents: number): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toLocaleString()}`;
  }
}

/**
 * Compute the best available value estimate for one artwork at a given timestamp.
 * `valuations` should be pre-filtered to those for this artwork, sorted newest-first.
 */
export function valueAt(
  artwork: ArtworkValueRow,
  /** All valuation rows for this artwork (any order), will be filtered by `t` */
  valuations: ValuationRow[],
  t: Date,
): ValueResult {
  // Step 1 — formal valuation (newest row with generated_at <= t)
  const tMs = t.getTime();
  const formalValuation = valuations
    .filter((v) => new Date(v.generated_at).getTime() <= tMs)
    .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];

  if (formalValuation && formalValuation.estimated_value_cents != null) {
    const val = formalValuation.estimated_value_cents;
    const low = formalValuation.confidence_low_cents ?? val;
    const high = formalValuation.confidence_high_cents ?? val;
    const dateStr = formatDateShort(formalValuation.generated_at);
    const hasRange = low !== high;
    const reasoning = hasRange
      ? `Formal valuation from ${dateStr} — confidence range ${formatMoneyCents(low)} – ${formatMoneyCents(high)}`
      : `Formal valuation from ${dateStr}`;
    return {
      value_cents: val,
      low_cents: low,
      high_cents: high,
      fromValuation: true,
      source: 'formal_valuation',
      reasoning,
      details: { valuationGeneratedAt: formalValuation.generated_at },
    };
  }

  // Step 2 — recorded sale price
  if (
    artwork.sold_price_cents != null &&
    artwork.sold_price_cents > 0 &&
    artwork.sold_at &&
    new Date(artwork.sold_at).getTime() <= tMs
  ) {
    const val = artwork.sold_price_cents;
    const dateStr = formatDateShort(artwork.sold_at);
    return {
      value_cents: val,
      low_cents: val,
      high_cents: val,
      fromValuation: false,
      source: 'sale_price',
      reasoning: `Recorded sale price on ${dateStr}`,
      details: { saleDate: artwork.sold_at },
    };
  }

  // Step 3 — declared free-text value
  const declared = parseDeclaredValueCents(artwork.value);
  if (declared > 0) {
    return {
      value_cents: declared,
      low_cents: declared,
      high_cents: declared,
      fromValuation: false,
      source: 'declared_value',
      reasoning: `Value you declared on the certificate${artwork.value ? ` ("${artwork.value}")` : ''}`,
      details: { declaredValueRaw: artwork.value },
    };
  }

  // Step 4 — unknown
  return {
    value_cents: 0,
    low_cents: 0,
    high_cents: 0,
    fromValuation: false,
    source: 'unknown',
    reasoning: 'No value declared yet — enter a value when editing the artwork or request a formal valuation',
    details: {},
  };
}
