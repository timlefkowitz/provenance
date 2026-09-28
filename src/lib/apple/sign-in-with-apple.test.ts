import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@kit/supabase/server-admin-client', () => ({ getSupabaseServerAdminClient: () => ({}) }));

import { buildAppleClientSecret } from './sign-in-with-apple';

function decode(part: string) {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

describe('buildAppleClientSecret', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const config = {
    teamId: 'TEAM123456',
    clientId: 'guru.provenance.web',
    keyId: 'KEY1234567',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('builds the claims Apple requires', () => {
    const jwt = buildAppleClientSecret(config, 1_000_000);
    const [header, payload] = jwt.split('.');
    expect(decode(header!)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decode(payload!)).toEqual({
      iss: 'TEAM123456',
      iat: 1_000_000,
      exp: 1_000_300,
      aud: 'https://appleid.apple.com',
      sub: 'guru.provenance.web',
    });
  });

  it('produces a valid ES256 (P1363) signature', () => {
    const [header, payload, sig] = buildAppleClientSecret(config, 1_000_000).split('.');
    const signature = Buffer.from(sig!.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expect(signature.length).toBe(64);
    const verifier = createVerify('SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(true);
  });
});
