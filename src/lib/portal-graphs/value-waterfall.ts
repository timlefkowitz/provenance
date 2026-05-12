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

export interface ValueResult {
  value_cents: number;
  low_cents: number;
  high_cents: number;
  /** true if step 1 (formal valuation) was used */
  fromValuation: boolean;
}

/** Parse a free-text declared value like "$5,000" or "5000" into cents */
function parseDeclaredValueCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const numeric = Number((raw.match(/[0-9.]+/) ?? ['0'])[0]);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
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
    return { value_cents: val, low_cents: low, high_cents: high, fromValuation: true };
  }

  // Step 2 — recorded sale price
  if (
    artwork.sold_price_cents != null &&
    artwork.sold_price_cents > 0 &&
    artwork.sold_at &&
    new Date(artwork.sold_at).getTime() <= tMs
  ) {
    const val = artwork.sold_price_cents;
    return { value_cents: val, low_cents: val, high_cents: val, fromValuation: false };
  }

  // Step 3 — declared free-text value
  const declared = parseDeclaredValueCents(artwork.value);
  if (declared > 0) {
    return { value_cents: declared, low_cents: declared, high_cents: declared, fromValuation: false };
  }

  // Step 4 — unknown
  return { value_cents: 0, low_cents: 0, high_cents: 0, fromValuation: false };
}
