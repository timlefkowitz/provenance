import { isNativePlatform } from './is-native';

/**
 * Opens a Stripe Checkout (or other external payment) URL.
 *
 * On native iOS: uses SFSafariViewController via @capacitor/browser.
 * SFSafariViewController supports Apple Pay, whereas the Capacitor WKWebView
 * does not reliably surface Apple Pay on Stripe Checkout pages.
 * `onClose` runs when the buyer taps Done to come back to the app (paid or
 * not), e.g. to reload the page so a just-bought work shows as sold.
 *
 * On web: falls back to a normal top-level redirect (window.location.href).
 */
export async function openExternalCheckout(
  url: string,
  options: { onClose?: () => void } = {},
): Promise<void> {
  if (isNativePlatform()) {
    console.log('[Checkout] Opening in SFSafariViewController', { url: url.slice(0, 60) });
    const { Browser } = await import('@capacitor/browser');
    if (options.onClose) {
      const handle = await Browser.addListener('browserFinished', () => {
        void handle.remove();
        options.onClose?.();
      });
    }
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.href = url;
  }
}

/** Reload the app's page after an in-app checkout sheet closes. */
export function reloadAfterCheckout(): void {
  console.log('[Checkout] sheet closed, reloading');
  window.location.reload();
}
