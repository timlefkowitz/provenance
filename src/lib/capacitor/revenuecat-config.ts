import type { SubscriptionRole, SubscriptionInterval } from '~/lib/stripe-config';

/**
 * RevenueCat iOS SDK public API key.
 * Set NEXT_PUBLIC_REVENUECAT_API_KEY_IOS in your .env / Vercel env vars.
 * This is safe to expose client-side (it's a public key, not a secret).
 */
export function getRevenueCatApiKeyIOS(): string {
  return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
}

/**
 * RevenueCat server-side secret API key (for REST API calls from the backend).
 * Set REVENUECAT_API_KEY_SECRET in your server-side env vars (not NEXT_PUBLIC_).
 */
export function getRevenueCatSecretKey(): string {
  return process.env.REVENUECAT_API_KEY_SECRET ?? '';
}

/**
 * Webhook shared secret — sent by RevenueCat in the Authorization header.
 * Set REVENUECAT_WEBHOOK_SECRET in your server-side env vars.
 */
export function getRevenueCatWebhookSecret(): string {
  return process.env.REVENUECAT_WEBHOOK_SECRET ?? '';
}

/**
 * Apple In-App Purchase product identifiers as configured in App Store Connect
 * and mirrored in RevenueCat. Format: com.provenance.app.<role>.<interval>
 *
 * These must match exactly what you create in App Store Connect
 * (Subscriptions section) and what RevenueCat's offerings reference.
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

/**
 * RevenueCat entitlement identifiers to configure in the RC dashboard.
 * One entitlement per role covers both monthly and yearly.
 */
export const RC_ENTITLEMENT_IDS: Record<SubscriptionRole, string> = {
  artist:    'provenance_artist',
  collector: 'provenance_collector',
  gallery:   'provenance_gallery',
};

/**
 * The identifier of the RevenueCat Offering to display on the subscription page.
 * Matches what you configure in the RevenueCat dashboard under Offerings.
 */
export const RC_OFFERING_IDENTIFIER = 'default';
