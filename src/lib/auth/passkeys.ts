import { isNativePlatform, nativeBuildAtLeast } from '~/lib/capacitor/is-native';

/**
 * First iOS build whose entitlements include `webcredentials:www.provenance.guru`.
 * WKWebView rejects WebAuthn for a relying party the app isn't associated with,
 * so older installs must not be offered passkeys.
 *
 * The Supabase passkey Relying Party ID is `www.provenance.guru` and must stay in
 * step with that entitlement and public/.well-known/apple-app-site-association.
 * Changing it orphans every passkey users have already created.
 */
const MIN_PASSKEY_NATIVE_BUILD = 9;

let serverEnabled: Promise<boolean> | null = null;

/**
 * Whether passkeys are switched on for the Supabase project (Authentication →
 * Passkeys). Read from the public GoTrue settings so the UI stays hidden until
 * they are, instead of failing with `passkey_disabled`.
 */
export function passkeysEnabledOnServer(): Promise<boolean> {
  serverEnabled ??= fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((settings: { passkeys_enabled?: boolean } | null) => settings?.passkeys_enabled === true)
    .catch((err) => {
      console.error('[Auth/Passkey] settings fetch failed', err);
      serverEnabled = null;
      return false;
    });
  return serverEnabled;
}

/** True when this device can use passkeys and they're enabled for the project. */
export async function passkeysSupported(): Promise<boolean> {
  if (!(await passkeysSupportedOnDevice())) return false;
  return passkeysEnabledOnServer();
}

/** Device-only check: a WebAuthn-capable browser, or an iOS app build that's associated with the domain. */
export async function passkeysSupportedOnDevice(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  if (isNativePlatform()) return nativeBuildAtLeast(MIN_PASSKEY_NATIVE_BUILD);
  return true;
}

/** Passkey suggestions in the keyboard / autofill bar (WebAuthn Conditional UI). */
export async function passkeyAutofillSupported(): Promise<boolean> {
  if (!(await passkeysSupported())) return false;
  try {
    return (await PublicKeyCredential.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * The user dismissed the system sheet, had no passkey for this site, or we
 * aborted the request ourselves — none of these deserve an error message.
 * WebAuthnError isn't exported from supabase-js, so this duck-types it.
 */
export function isPasskeyCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, name, cause } = error as { code?: string; name?: string; cause?: { name?: string } };
  return (
    code === 'ERROR_CEREMONY_ABORTED' ||
    name === 'NotAllowedError' ||
    name === 'AbortError' ||
    cause?.name === 'NotAllowedError' ||
    cause?.name === 'AbortError'
  );
}

/** The autofill request outlived its server challenge (5 min) — restart it. */
export function isPasskeyChallengeExpired(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'webauthn_challenge_expired';
}

export function passkeyErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'passkey_disabled') return 'Passkeys aren’t available right now. Please sign in another way.';
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'This device already has a passkey for your account.';
  return 'We couldn’t sign you in with that passkey. Please try again or use another sign-in method.';
}
