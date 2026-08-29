import { isNativePlatform } from './is-native';

/**
 * Opens a Stripe Checkout (or other external payment) URL.
 *
 * On native iOS: uses SFSafariViewController via @capacitor/browser.
 * SFSafariViewController supports Apple Pay, whereas the Capacitor WKWebView
 * does not reliably surface Apple Pay on Stripe Checkout pages.
 *
 * On web: falls back to a normal top-level redirect (window.location.href).
 */
export async function openExternalCheckout(url: string): Promise<void> {
  if (isNativePlatform()) {
    console.log('[Checkout] Opening in SFSafariViewController', { url: url.slice(0, 60) });
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.href = url;
  }
}
