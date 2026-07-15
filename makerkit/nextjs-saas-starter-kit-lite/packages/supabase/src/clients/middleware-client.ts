import 'server-only';

import { createServerClient } from '@supabase/ssr';

import { Database } from '../database.types';
import { getHardenedCookieOptions } from '../cookie-options';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * Structural subset of NextRequest used by this client.
 * Avoids importing NextRequest from 'next/server' directly, which causes
 * TypeScript errors in pnpm monorepos where multiple workspaces resolve
 * next to different physical installations (same version, different peer deps).
 */
interface MiddlewareRequest {
  cookies: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string): void;
  };
}

/**
 * Structural subset of NextResponse used by this client.
 */
interface MiddlewareResponse {
  cookies: {
    // options comes from @supabase/ssr's CookieSerializeOptions — typed loosely
    // so any Next.js version's ResponseCookies.set signature satisfies this.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set(name: string, value: string, options?: any): void;
  };
  headers: {
    set(name: string, value: string): void;
  };
}

/**
 * Creates a middleware client for Supabase.
 *
 * @param {MiddlewareRequest} request - The Next.js request object (or compatible structural type).
 * @param {MiddlewareResponse} response - The Next.js response object (or compatible structural type).
 */
export function createMiddlewareClient<GenericSchema = Database>(
  request: MiddlewareRequest,
  response: MiddlewareResponse,
) {
  const keys = getSupabaseClientKeys();

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookieOptions: getHardenedCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );

        // @supabase/ssr v0.10+ passes Cache-Control / Expires / Pragma on token
        // refresh so CDNs do not cache auth responses and leak sessions.
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });
}
