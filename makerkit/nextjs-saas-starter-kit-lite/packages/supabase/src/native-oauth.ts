import type {
  SignInWithOAuthCredentials,
  SupabaseClient,
} from '@supabase/supabase-js';

/**
 * @name NativeOAuthHandler
 * @description
 * Lets a host app (e.g. a Capacitor iOS shell) take over an OAuth sign-in
 * that would otherwise navigate the current page to the provider. Resolves
 * `true` when it handled the sign-in, `false` to fall back to the default
 * web redirect.
 */
export type NativeOAuthHandler = (
  client: SupabaseClient,
  credentials: SignInWithOAuthCredentials,
) => Promise<boolean>;

let handler: NativeOAuthHandler | null = null;

export function setNativeOAuthHandler(next: NativeOAuthHandler | null) {
  handler = next;
}

export function getNativeOAuthHandler() {
  return handler;
}
