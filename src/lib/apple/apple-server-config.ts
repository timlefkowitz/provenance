/** Matches capacitor.config.ts's `appId`. */
export function getAppleBundleId(): string {
  return 'guru.provenance.app';
}

/**
 * The app's numeric Apple ID (App Store Connect → App Information → General
 * Information → Apple ID). Apple's verifier requires it to validate
 * Production-signed transactions and notifications; Sandbox ones don't need it.
 */
export function getAppleAppId(): number {
  const raw = process.env.APPLE_APP_ID;
  const id = raw ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      'APPLE_APP_ID is not set (numeric Apple ID from App Store Connect). ' +
        'Required to verify Production App Store transactions.',
    );
  }
  return id;
}
