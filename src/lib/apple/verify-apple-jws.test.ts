import { afterEach, describe, expect, it } from 'vitest';
import { verifyTransactionJWS } from './verify-apple-jws';

/** Unsigned JWS-shaped string: enough to exercise environment routing. */
function fakeJws(payload: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'ES256' })}.${b64(payload)}.sig`;
}

describe('verifyTransactionJWS', () => {
  const original = process.env.APPLE_APP_ID;
  afterEach(() => {
    if (original === undefined) delete process.env.APPLE_APP_ID;
    else process.env.APPLE_APP_ID = original;
  });

  it('routes Sandbox payloads to a verifier that needs no app ID', async () => {
    delete process.env.APPLE_APP_ID;
    const err = await verifyTransactionJWS(fakeJws({ environment: 'Sandbox' })).catch((e) => e);
    // Fails on the (fake) signature, not on configuration.
    expect(String(err?.message ?? err)).not.toMatch(/APPLE_APP_ID/);
  });

  it('requires APPLE_APP_ID for Production payloads, with a clear error', async () => {
    delete process.env.APPLE_APP_ID;
    await expect(verifyTransactionJWS(fakeJws({ environment: 'Production' }))).rejects.toThrow(/APPLE_APP_ID/);
  });

  it('rejects malformed payloads and unknown environments', async () => {
    await expect(verifyTransactionJWS('not-a-jws')).rejects.toThrow();
    await expect(verifyTransactionJWS(fakeJws({ environment: 'Xcode' }))).rejects.toThrow(/Unsupported/);
  });
});
