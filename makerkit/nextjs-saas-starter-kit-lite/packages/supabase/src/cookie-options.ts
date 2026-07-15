import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Explicit hardened cookie options for all Supabase auth cookies.
 *
 * - `secure`: always set in production so session cookies are never sent
 *   over plaintext HTTP.
 * - `sameSite: 'lax'`: blocks cross-site sends on unsafe methods (CSRF
 *   mitigation) while keeping top-level navigation logins working.
 * - `httpOnly` is intentionally NOT enabled: the app uses
 *   `createBrowserClient` for client-side auth flows (sign-up, session
 *   refresh, realtime), which requires JavaScript access to the auth
 *   cookies. @supabase/ssr defaults `httpOnly` to false by design.
 *   Session cookies are protected instead via CSP, Secure, and SameSite.
 */
export function getHardenedCookieOptions(): CookieOptionsWithName {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}
