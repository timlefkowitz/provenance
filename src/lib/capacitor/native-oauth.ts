import type { NativeOAuthHandler } from '@kit/supabase/native-oauth';

import { isNativePlatform, nativeBuildAtLeast } from './is-native';

/**
 * Custom URL scheme registered in ios/App/App/Info.plist (CFBundleURLTypes).
 * Supabase redirects here after the provider round-trip, which hands control
 * back from SFSafariViewController to the app. Must also be on the Supabase
 * Auth → URL Configuration → Redirect URLs allowlist as
 * `guru.provenance.app://auth/callback**`.
 */
export const NATIVE_AUTH_SCHEME = 'guru.provenance.app';

/**
 * Google refuses OAuth inside embedded web views (disallowed_useragent), so on
 * native it has to run in SFSafariViewController. Apple works in the WKWebView
 * and stays there.
 */
const SYSTEM_BROWSER_PROVIDERS = new Set(['google']);

/**
 * First iOS build that registers NATIVE_AUTH_SCHEME (uploaded build 9 didn't);
 * older installs would get stuck in the browser sheet.
 */
const MIN_NATIVE_OAUTH_BUILD = 10;

/**
 * Runs the provider step in SFSafariViewController. signInWithOAuth still runs
 * here in the WKWebView so the PKCE code_verifier cookie lands in the WebView's
 * cookie jar — handleNativeAuthCallbackUrl then finishes /auth/callback in the
 * WebView, where that cookie is present.
 */
export const nativeOAuthHandler: NativeOAuthHandler = async (client, credentials) => {
  if (!isNativePlatform() || !SYSTEM_BROWSER_PROVIDERS.has(credentials.provider)) return false;
  if (!(await nativeBuildAtLeast(MIN_NATIVE_OAUTH_BUILD))) return false;

  const webRedirect = new URL(credentials.options?.redirectTo ?? '/auth/callback', window.location.origin);
  const redirectTo = `${NATIVE_AUTH_SCHEME}://auth/callback${webRedirect.search}`;

  const { data, error } = await client.auth.signInWithOAuth({
    ...credentials,
    options: { ...credentials.options, redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw error.message;

  console.log('[NativeOAuth] Opening provider in SFSafariViewController', { provider: credentials.provider });
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
  return true;
};

/**
 * Handles `guru.provenance.app://auth/callback?code=…` from appUrlOpen: closes
 * the browser sheet and completes the code exchange in the WebView.
 */
export async function handleNativeAuthCallbackUrl(url: URL): Promise<boolean> {
  if (url.protocol !== `${NATIVE_AUTH_SCHEME}:`) return false;

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    // Sheet already dismissed.
  }

  window.location.assign(`/auth/callback${url.search}`);
  return true;
}
