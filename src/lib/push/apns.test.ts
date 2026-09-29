import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildApnsBody, buildApnsJwt, isDeadTokenResult, isWrongEnvironmentResult } from './apns';

function decode(part: string) {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

describe('buildApnsJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const config = {
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    bundleId: 'guru.provenance.app',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('builds the claims APNs requires, with a valid ES256 signature', () => {
    const [header, payload, sig] = buildApnsJwt(config, 1_000_000).split('.');
    expect(decode(header!)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decode(payload!)).toEqual({ iss: 'TEAM123456', iat: 1_000_000 });

    const signature = Buffer.from(sig!.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const verifier = createVerify('SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(true);
  });
});

describe('buildApnsBody', () => {
  it('puts the alert under aps and the tap path at the top level', () => {
    expect(JSON.parse(buildApnsBody({ title: 'Scanned', body: 'Your COA was scanned', path: '/notifications' }))).toEqual({
      aps: { alert: { title: 'Scanned', body: 'Your COA was scanned' }, sound: 'default' },
      path: '/notifications',
    });
  });

  it('omits body and path when not given', () => {
    expect(JSON.parse(buildApnsBody({ title: 'Hi' }))).toEqual({ aps: { alert: { title: 'Hi' }, sound: 'default' } });
  });
});

describe('APNs result classification', () => {
  it('treats 410 and Unregistered as dead tokens', () => {
    expect(isDeadTokenResult({ ok: false, status: 410, reason: 'Unregistered' })).toBe(true);
    expect(isDeadTokenResult({ ok: false, status: 400, reason: 'BadDeviceToken' })).toBe(false);
    expect(isDeadTokenResult({ ok: true })).toBe(false);
  });

  it('treats BadDeviceToken as a wrong-environment token', () => {
    expect(isWrongEnvironmentResult({ ok: false, status: 400, reason: 'BadDeviceToken' })).toBe(true);
    expect(isWrongEnvironmentResult({ ok: false, status: 400, reason: 'PayloadTooLarge' })).toBe(false);
  });
});
