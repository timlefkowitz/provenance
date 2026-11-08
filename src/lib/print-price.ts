/**
 * Price formatting for printed material (wall labels, checklists, catalogs),
 * plus the remembered "show $ before prices" choice shared by every print menu.
 */

const PRICE_SYMBOL_KEY = 'provenance.print.priceSymbol';

/**
 * Prices are free text. Plain amounts ("12000", "$12,000.00") are normalised
 * and shown with or without a dollar sign; anything else ("POA", "€5,000",
 * "$8,000 framed") is kept as typed, minus a leading "$" when the symbol is off.
 */
export function formatPrintPrice(raw: string | null | undefined, withSymbol: boolean): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const numeric = value.match(/^\$?\s*([\d,]+(?:\.\d+)?)$/);
  if (numeric) {
    const num = Number(numeric[1]!.replace(/,/g, ''));
    if (Number.isFinite(num)) {
      const decimals = Number.isInteger(num) ? 0 : 2;
      const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return withSymbol ? `$${formatted}` : formatted;
    }
  }
  return withSymbol ? value : value.replace(/^\$\s*/, '');
}

/** Whether printed prices get a "$". Defaults to true. */
export function loadPriceSymbolPref(): boolean {
  try {
    return window.localStorage.getItem(PRICE_SYMBOL_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function savePriceSymbolPref(withSymbol: boolean): void {
  try {
    window.localStorage.setItem(PRICE_SYMBOL_KEY, String(withSymbol));
  } catch {
    // storage unavailable — choice lasts for this page only
  }
}
