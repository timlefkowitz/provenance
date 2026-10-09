import { registerPlugin } from '@capacitor/core';

export type AppleSignInResult = {
  identityToken: string;
  authorizationCode?: string;
  /** Only present on the user's first authorization with this app. */
  givenName?: string;
  familyName?: string;
  email?: string;
};

/**
 * System sign-in sheets (ios/App/CapApp-SPM/Sources/CapApp-SPM/NativeAuthPlugin.swift).
 * Both methods reject with code "canceled" when the user dismisses the sheet,
 * and "UNIMPLEMENTED" on builds that predate the plugin.
 */
export interface NativeAuthPlugin {
  /** ASWebAuthenticationSession; resolves with the `callbackScheme://…` URL. */
  startWebSession(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
  /** Native Sign in with Apple. `nonce` is the SHA-256 hex of the raw nonce. */
  signInWithApple(options: { nonce: string }): Promise<AppleSignInResult>;
}

export const NativeAuth = registerPlugin<NativeAuthPlugin>('NativeAuth');

export function nativeAuthErrorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}
