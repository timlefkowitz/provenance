/**
 * Stripe price IDs by role and interval.
 * Set these in .env after creating Products and Prices in Stripe Dashboard.
 */
const env = process.env;

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

export function getStripePriceId(
  role: SubscriptionRole,
  interval: SubscriptionInterval
): string | null {
  const key = PRICE_KEYS[role]?.[interval];
  if (!key) return null;
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      getStripePriceId('artist', 'month') &&
      getStripePriceId('artist', 'year')
  );
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
