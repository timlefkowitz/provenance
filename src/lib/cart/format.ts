export function formatPrice(cents: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const UNAVAILABLE_LABEL: Record<string, string> = {
  not_found: 'No longer in this show',
  sales_closed: 'Online sales closed for this show',
  not_for_sale: 'No longer for sale',
  sold: 'Sold',
  held: 'Someone is checking out this work right now',
};
