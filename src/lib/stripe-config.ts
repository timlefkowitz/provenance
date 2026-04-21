/**
 * Stripe price IDs by role and interval.
 * Set these in .env after creating Products and Prices in Stripe Dashboard.
 * process.env is only read inside server-called functions so this file stays safe for client imports.
 */
export type SubscriptionInterval = 'month' | 'year';
export type SubscriptionRole = 'artist' | 'collector' | 'gallery';

const PRICE_KEYS: Record<SubscriptionRole, Record<SubscriptionInterval, string>> = {
  artist: {
    month: 'STRIPE_PRICE_ARTIST_MONTHLY',
    year: 'STRIPE_PRICE_ARTIST_YEARLY',
  },
  collector: {
    month: 'STRIPE_PRICE_COLLECTOR_MONTHLY',
    year: 'STRIPE_PRICE_COLLECTOR_YEARLY',
  },
  gallery: {
    month: 'STRIPE_PRICE_GALLERY_MONTHLY',
    year: 'STRIPE_PRICE_GALLERY_YEARLY',
  },
};

function getEnv(): Record<string, string | undefined> {
  if (typeof process === 'undefined') return {};
  return process.env as Record<string, string | undefined>;
}

export function getStripePriceId(
  role: SubscriptionRole,
  interval: SubscriptionInterval
): string | null {
  const key = PRICE_KEYS[role]?.[interval];
  if (!key) return null;
  const env = getEnv();
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Display prices for the subscription page (not from Stripe) */
export const SUBSCRIPTION_PRICES: Record<
  SubscriptionRole,
  { monthly: number; yearly: number; yearlyLabel: string }
> = {
  artist: { monthly: 10, yearly: 99, yearlyLabel: '$99/year' },
  collector: { monthly: 29.99, yearly: 299.9, yearlyLabel: '$299.90/year' },
  gallery: { monthly: 99, yearly: 990, yearlyLabel: '$990/year' },
};
