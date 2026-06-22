declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

import { capturePostHogEvent, PH_EVENTS } from './posthog';

/** Read UTM cookie stored by UtmCapture without importing the component. */
function readUtmCookie(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(/(?:^|; )pv_utm=([^;]*)/);
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1] ?? '')) as Record<string, string>;
  } catch {
    return {};
  }
}

type ConsentState = 'granted' | 'denied';

interface ConsentParams {
  ad_storage: ConsentState;
  analytics_storage: ConsentState;
  ad_user_data: ConsentState;
  ad_personalization: ConsentState;
}

interface PurchaseParams {
  role: string;
  interval: string;
  value?: number;
}

/**
 * GtmService — singleton wrapper around window.dataLayer and the gtag consent API.
 * All methods are safe to call server-side (no-ops when window is absent).
 */
class GtmService {
  private static _instance: GtmService;

  private constructor() {}

  static getInstance(): GtmService {
    if (!GtmService._instance) {
      GtmService._instance = new GtmService();
    }
    return GtmService._instance;
  }

  // ─── internals ──────────────────────────────────────────────────────────────

  private push(data: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }

  /**
   * Sends a gtag consent command. Prefers the globally-defined gtag() function
   * when available (guarantees the correct Arguments format GTM expects).
   * Falls back to a compatible dataLayer object push if gtag hasn't loaded yet.
   */
  private consentUpdate(params: ConsentParams): void {
    if (typeof window === 'undefined') return;
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', params);
    } else {
      // gtag not yet defined — push in gtag-compatible format
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 0: 'consent', 1: 'update', 2: params, length: 3 });
    }
  }

  // ─── consent ────────────────────────────────────────────────────────────────

  grantConsent(): void {
    console.log('[GTM] grantConsent');
    this.consentUpdate({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  }

  denyConsent(): void {
    console.log('[GTM] denyConsent');
    this.consentUpdate({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }

  // ─── conversion events ──────────────────────────────────────────────────────

  /**
   * Fires a Google Ads conversion event directly via gtag.
   * Conversion ID and label come from the Google Ads "Sign-up" conversion action.
   */
  private fireGoogleAdsConversion(): void {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'conversion', {
      send_to: 'AW-18140035105/t81PCLn4478cEKHw68lD',
    });
    console.log('[GTM] Google Ads conversion fired');
  }

  trackSignup(): void {
    const utm = readUtmCookie();
    console.log('[GTM] trackSignup', utm);
    this.push({ event: 'signup', ...utm });
    this.fireGoogleAdsConversion();
    capturePostHogEvent(PH_EVENTS.SIGNUP, utm);
  }

  trackTrialStarted(): void {
    const utm = readUtmCookie();
    console.log('[GTM] trackTrialStarted', utm);
    this.push({ event: 'trial_started', ...utm });
    capturePostHogEvent(PH_EVENTS.TRIAL_STARTED, utm);
  }

  trackPurchase(params: PurchaseParams): void {
    console.log('[GTM] trackPurchase', params);
    this.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: `${params.role}_${Date.now()}`,
        value: params.value ?? 0,
        currency: 'USD',
        items: [
          {
            item_name: `Provenance ${params.role} ${params.interval}`,
            item_category: params.role,
            item_variant: params.interval,
          },
        ],
      },
    });
    capturePostHogEvent(PH_EVENTS.SUBSCRIPTION_STARTED, {
      role: params.role,
      interval: params.interval,
      value: params.value,
    });
  }

  trackOnboardingComplete(role: string): void {
    const utm = readUtmCookie();
    console.log('[GTM] trackOnboardingComplete', { role, ...utm });
    this.push({ event: 'onboarding_complete', role, ...utm });
    capturePostHogEvent(PH_EVENTS.ONBOARDING_COMPLETE, { role, ...utm });
  }

  trackArtworkCreated(isFirst: boolean): void {
    const utm = readUtmCookie();
    console.log('[GTM] trackArtworkCreated', { isFirst, ...utm });
    this.push({ event: 'artwork_created', is_first_artwork: isFirst, ...utm });
    capturePostHogEvent(PH_EVENTS.CERTIFICATE_CREATED, { is_first: isFirst, ...utm });
  }

  trackLead(): void {
    console.log('[GTM] trackLead');
    this.push({ event: 'lead' });
  }
}

export const gtmService = GtmService.getInstance();
