import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { getAppleAppId, getAppleBundleId } from './apple-server-config';

/**
 * Apple Root CA - G3 (DER, base64-encoded), downloaded from
 * https://www.apple.com/certificateauthority/AppleRootCA-G3.cer — the root
 * that App Store Server transaction/notification signatures chain up to.
 * Inlined (rather than read from disk at runtime) so it's always bundled with
 * the serverless function regardless of file-tracing config. Valid until
 * 2039-04-30; re-download from the URL above if Apple ever rotates it.
 */
const APPLE_ROOT_CA_G3_BASE64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

const verifiers = new Map<Environment, SignedDataVerifier>();

function getVerifier(environment: Environment): SignedDataVerifier {
  let verifier = verifiers.get(environment);
  if (!verifier) {
    verifier = new SignedDataVerifier(
      [Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64')],
      true, // enableOnlineChecks
      environment,
      getAppleBundleId(),
      // Sandbox omits the app ID; Production requires it.
      environment === Environment.PRODUCTION ? getAppleAppId() : undefined,
    );
    verifiers.set(environment, verifier);
  }
  return verifier;
}

/**
 * The same deployment receives both Production transactions and Sandbox ones
 * (App Review, TestFlight and Xcode/sandbox testers), so the environment can't
 * be a deploy-time setting. Read it from the still-unverified payload purely
 * to pick which verifier to run — that verifier then checks the signature
 * chain and rejects the payload if its environment doesn't match.
 */
function environmentOf(jws: string, pick: (payload: any) => unknown): Environment {
  let claimed: unknown;
  try {
    const payload = JSON.parse(Buffer.from(jws.split('.')[1] ?? '', 'base64url').toString('utf8'));
    claimed = pick(payload);
  } catch {
    throw new Error('Malformed JWS payload');
  }
  if (claimed === Environment.SANDBOX) return Environment.SANDBOX;
  if (claimed === Environment.PRODUCTION) return Environment.PRODUCTION;
  throw new Error(`Unsupported App Store environment: ${String(claimed)}`);
}

/** Verifies and decodes a StoreKit 2 `transaction.jwsRepresentation`. */
export async function verifyTransactionJWS(jws: string) {
  const environment = environmentOf(jws, (p) => p.environment);
  return getVerifier(environment).verifyAndDecodeTransaction(jws);
}

/** Verifies and decodes an App Store Server Notifications V2 `signedPayload`. */
export async function verifyNotificationPayload(signedPayload: string) {
  const environment = environmentOf(signedPayload, (p) => p.data?.environment);
  return getVerifier(environment).verifyAndDecodeNotification(signedPayload);
}
