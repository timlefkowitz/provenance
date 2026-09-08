import { Environment } from '@apple/app-store-server-library';

/** Matches capacitor.config.ts's `appId`. */
export function getAppleBundleId(): string {
  return 'guru.provenance.app';
}

/**
 * Defaults to Production. Set APPLE_IAP_ENVIRONMENT=sandbox locally / in
 * preview deployments to verify Sandbox-signed transactions during testing.
 */
export function getAppleEnvironment(): Environment {
  return process.env.APPLE_IAP_ENVIRONMENT === 'sandbox'
    ? Environment.SANDBOX
    : Environment.PRODUCTION;
}
