/**
 * App-mode detection utilities.
 *
 * "App mode" covers both the Capacitor native shell (iOS/Android) and an
 * installed PWA running in standalone display mode.  Components use these
 * helpers to gate native-app UI (bottom tab bar, splash animation, etc.)
 * without caring about which wrapper is in use.
 *
 * All functions are SSR-safe: they return false when called on the server.
 */

import { isNativePlatform } from '~/lib/capacitor/is-native';

/**
 * Returns true when the web app is running as an installed PWA in standalone
 * display mode (i.e. launched from the home screen, no browser chrome).
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Standard spec: display-mode media query
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    // Safari/iOS legacy property
    if ((navigator as { standalone?: boolean }).standalone === true) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns true when the app is running inside any installed shell:
 * Capacitor native wrapper OR an installed PWA in standalone mode.
 */
export function isAppMode(): boolean {
  return isNativePlatform() || isStandalonePWA();
}
