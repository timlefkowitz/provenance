import type { SubscriptionRole, SubscriptionInterval } from '~/lib/stripe-config';

/**
 * Apple In-App Purchase product identifiers as configured in App Store Connect.
 * Format: com.provenance.app.<role>.<interval>
 *
 * These must match exactly what you create in App Store Connect
 * (Subscriptions section).
 */
export const APPLE_PRODUCT_TO_PLAN: Record<string, {
  role: SubscriptionRole;
  interval: SubscriptionInterval;
}> = {
  'com.provenance.app.artist.monthly':   { role: 'artist',    interval: 'month' },
  'com.provenance.app.artist.yearly':    { role: 'artist',    interval: 'year'  },
  'com.provenance.app.collector.monthly':{ role: 'collector', interval: 'month' },
  'com.provenance.app.collector.yearly': { role: 'collector', interval: 'year'  },
  'com.provenance.app.gallery.monthly':  { role: 'gallery',   interval: 'month' },
  'com.provenance.app.gallery.yearly':   { role: 'gallery',   interval: 'year'  },
};

/** Reverse lookup: given role + interval, return the Apple product identifier. */
export function getAppleProductId(role: SubscriptionRole, interval: SubscriptionInterval): string | null {
  for (const [productId, plan] of Object.entries(APPLE_PRODUCT_TO_PLAN)) {
    if (plan.role === role && plan.interval === interval) return productId;
  }
  return null;
}
