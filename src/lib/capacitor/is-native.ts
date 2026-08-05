/**
 * Safe wrappers around Capacitor's platform detection APIs.
 *
 * All functions are safe to call in SSR (returns false/web) and in regular
 * browsers (same). They only return true/ios when running inside the
 * Provenance Capacitor native shell.
 */

type NativePlatform = 'ios' | 'android';
type Platform = NativePlatform | 'web';

function getCapacitor(): { isNativePlatform: () => boolean; getPlatform: () => string } | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w?.Capacitor ?? null;
}

/** Returns true only when running inside the iOS (or Android) native shell. */
export function isNativePlatform(): boolean {
  try {
    return getCapacitor()?.isNativePlatform() ?? false;
  } catch {
    return false;
  }
}

/** Returns the current platform: 'ios' | 'android' | 'web'. */
export function getNativePlatform(): Platform {
  try {
    const p = getCapacitor()?.getPlatform();
    if (p === 'ios' || p === 'android') return p;
    return 'web';
  } catch {
    return 'web';
  }
}

/** Returns true only when running specifically on iOS native. */
export function isIOS(): boolean {
  return getNativePlatform() === 'ios';
}
