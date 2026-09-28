/**
 * Cookie the native iOS shell sets on launch (see NativeInit) so server routes
 * can tell an iOS-app request from a web one. Not a security boundary — it
 * only decides whether a new account gets the web-only server trial.
 */
export const NATIVE_PLATFORM_COOKIE = 'pv_platform';

export function isNativeAppRequest(cookieValue: string | undefined | null): boolean {
  return cookieValue === 'ios';
}
