import type { SignInWithOAuthCredentials, SupabaseClient } from '@supabase/supabase-js';
import type { NativeOAuthHandler } from '@kit/supabase/native-oauth';

import { isNativePlatform, nativeBuildAtLeast } from './is-native';
import { NativeAuth, nativeAuthErrorCode } from './native-auth';

/**
 * Custom URL scheme registered in ios/App/App/Info.plist (CFBundleURLTypes).
 * Supabase redirects here after the provider round-trip, which hands control
 * back to the app. Must also be on the Supabase Auth → URL Configuration →
 * Redirect URLs allowlist as `guru.provenance.app://auth/callback**`.
 */
export const NATIVE_AUTH_SCHEME = 'guru.provenance.app';

/**
 * First iOS build that registers NATIVE_AUTH_SCHEME (uploaded build 9 didn't);
 * older installs would get stuck in the SFSafariViewController fallback.
 * Builds with the NativeAuth plugin don't need this gate.
 */
const MIN_NATIVE_OAUTH_BUILD = 10;

/**
 * Takes over Google and Apple sign-in inside the iOS app:
 *
 * - Apple → native Sign in with Apple (one Face ID tap), finished server-side
 *   by /auth/native-apple.
 * - Google → ASWebAuthenticationSession, which shares Safari's cookies so a
 *   user already signed into Google just picks their account. (Google refuses
 *   OAuth inside the WKWebView itself: disallowed_useragent.)
 *
 * Builds without the NativeAuth plugin fall back to SFSafariViewController
 * for Google and the in-WebView flow for Apple.
 */
export const nativeOAuthHandler: NativeOAuthHandler = async (client, credentials) => {
  if (!isNativePlatform()) return false;

  switch (credentials.provider) {
    case 'apple':
      return signInWithAppleNative(credentials);
    case 'google':
      return signInWithGoogleNative(client, credentials);
    default:
      return false;
  }
};

async function signInWithAppleNative(credentials: SignInWithOAuthCredentials): Promise<boolean> {
  const rawNonce = randomHex(32);

  let result;
  try {
    // Apple embeds the hashed nonce in the identity token; Supabase checks it against the raw one.
    result = await NativeAuth.signInWithApple({ nonce: await sha256Hex(rawNonce) });
  } catch (err) {
    const code = nativeAuthErrorCode(err);
    if (code === 'UNIMPLEMENTED') return false;
    if (code === 'canceled') return true;
    console.error('[NativeOAuth] Sign in with Apple failed', err);
    throw 'Sign in with Apple failed. Please try again.';
  }

  const res = await fetch('/auth/native-apple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...result, nonce: rawNonce, next: nextParam(credentials) }),
  });
  const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };

  if (!res.ok || !body.redirectTo) {
    console.error('[NativeOAuth] /auth/native-apple failed', { status: res.status, error: body.error });
    throw body.error ?? 'Sign in with Apple failed. Please try again.';
  }

  window.location.assign(body.redirectTo);
  return true;
}

/**
 * signInWithOAuth runs here in the WKWebView so the PKCE code_verifier cookie
 * lands in the WebView's cookie jar; /auth/callback then finishes the code
 * exchange in the WebView, where that cookie is present.
 */
async function signInWithGoogleNative(client: SupabaseClient, credentials: SignInWithOAuthCredentials): Promise<boolean> {
  if (!(await nativeBuildAtLeast(MIN_NATIVE_OAUTH_BUILD))) return false;

  const webRedirect = new URL(credentials.options?.redirectTo ?? '/auth/callback', window.location.origin);
  const redirectTo = `${NATIVE_AUTH_SCHEME}://auth/callback${webRedirect.search}`;

  const { data, error } = await client.auth.signInWithOAuth({
    ...credentials,
    options: { ...credentials.options, redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw error.message;

  try {
    console.log('[NativeOAuth] Opening provider in ASWebAuthenticationSession', { provider: credentials.provider });
    const { url } = await NativeAuth.startWebSession({ url: data.url, callbackScheme: NATIVE_AUTH_SCHEME });
    window.location.assign(`/auth/callback${new URL(url).search}`);
    return true;
  } catch (err) {
    const code = nativeAuthErrorCode(err);
    if (code === 'canceled') return true;
    if (code !== 'UNIMPLEMENTED') {
      console.error('[NativeOAuth] ASWebAuthenticationSession failed', err);
      throw 'Sign in with Google failed. Please try again.';
    }
  }

  // Builds 10+ without the NativeAuth plugin: the callback comes back through
  // appUrlOpen → handleNativeAuthCallbackUrl.
  console.log('[NativeOAuth] Opening provider in SFSafariViewController', { provider: credentials.provider });
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
  return true;
}

/**
 * Handles `guru.provenance.app://auth/callback?code=…` from appUrlOpen (the
 * SFSafariViewController fallback): closes the browser sheet and completes the
 * code exchange in the WebView.
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

function nextParam(credentials: SignInWithOAuthCredentials): string | undefined {
  const redirect = credentials.options?.redirectTo;
  if (!redirect) return undefined;
  return new URL(redirect, window.location.origin).searchParams.get('next') ?? undefined;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
