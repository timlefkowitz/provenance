declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
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

  trackSignup(): void {
    console.log('[GTM] trackSignup');
    this.push({ event: 'signup' });
  }

  trackTrialStarted(): void {
    console.log('[GTM] trackTrialStarted');
    this.push({ event: 'trial_started' });
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
  }

  trackLead(): void {
    console.log('[GTM] trackLead');
    this.push({ event: 'lead' });
  }
}

export const gtmService = GtmService.getInstance();
