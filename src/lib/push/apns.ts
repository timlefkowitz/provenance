import 'server-only';

import { createSign } from 'node:crypto';
import { connect } from 'node:http2';

/**
 * Apple Push Notification service client (token-based auth, HTTP/2).
 *
 * Requires these env vars (Apple Developer → Certificates, Identifiers &
 * Profiles → Keys, a key with "Apple Push Notifications service" enabled):
 *   APNS_TEAM_ID      — 10-char Team ID
 *   APNS_KEY_ID       — the key's 10-char Key ID
 *   APNS_PRIVATE_KEY  — contents of the AuthKey_<KeyID>.p8 file
 *                       (literal "\n" sequences are accepted)
 *   APNS_BUNDLE_ID    — optional, defaults to guru.provenance.app
 */

export type ApnsEnvironment = 'production' | 'sandbox';

export type ApnsPayload = {
  title: string;
  body?: string;
  badge?: number;
  /** Path inside the app to open when the notification is tapped. */
  path?: string;
};

export type ApnsResult =
  | { ok: true }
  | { ok: false; status: number; reason: string };

const HOSTS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
};

type ApnsConfig = { teamId: string; keyId: string; privateKey: string; bundleId: string };

export function getApnsConfig(): ApnsConfig | null {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || 'guru.provenance.app';
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey, bundleId };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function buildApnsJwt(config: ApnsConfig, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const payload = base64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${base64url(signature)}`;
}

// APNs rejects tokens older than an hour and throttles ones refreshed more
// often than every 20 minutes, so reuse one for 50 minutes per instance.
let cachedJwt: { value: string; issuedAt: number } | null = null;

function getJwt(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (!cachedJwt || now - cachedJwt.issuedAt > 50 * 60) {
    cachedJwt = { value: buildApnsJwt(config, now), issuedAt: now };
  }
  return cachedJwt.value;
}

export function buildApnsBody(payload: ApnsPayload): string {
  return JSON.stringify({
    aps: {
      alert: payload.body ? { title: payload.title, body: payload.body } : { title: payload.title },
      sound: 'default',
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...(payload.path ? { path: payload.path } : {}),
  });
}

/**
 * Sends one alert to each token over a single HTTP/2 connection. Results are
 * in the same order as `tokens`.
 */
export async function sendApns(
  environment: ApnsEnvironment,
  tokens: string[],
  payload: ApnsPayload,
): Promise<ApnsResult[]> {
  const config = getApnsConfig();
  if (!config) {
    console.warn('[Push] APNS_* env vars not set; skipping send');
    return tokens.map(() => ({ ok: false, status: 0, reason: 'NotConfigured' }));
  }
  if (tokens.length === 0) return [];

  const jwt = getJwt(config);
  const body = buildApnsBody(payload);
  const session = connect(HOSTS[environment]);

  try {
    return await Promise.all(
      tokens.map(
        (token) =>
          new Promise<ApnsResult>((resolve) => {
            const req = session.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              'apns-topic': config.bundleId,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'content-type': 'application/json',
            });
            let status = 0;
            let data = '';
            req.setEncoding('utf8');
            req.on('response', (headers) => {
              status = Number(headers[':status'] ?? 0);
            });
            req.on('data', (chunk: string) => {
              data += chunk;
            });
            req.on('end', () => {
              if (status === 200) return resolve({ ok: true });
              let reason = 'Unknown';
              try {
                reason = (JSON.parse(data) as { reason?: string }).reason ?? reason;
              } catch {
                // empty body
              }
              resolve({ ok: false, status, reason });
            });
            req.on('error', (err) => resolve({ ok: false, status: 0, reason: err.message }));
            req.end(body);
          }),
      ),
    );
  } finally {
    session.close();
  }
}

/** Token is dead (app uninstalled, notifications reset): stop sending to it. */
export function isDeadTokenResult(result: ApnsResult): boolean {
  return !result.ok && (result.status === 410 || result.reason === 'Unregistered');
}

/** A sandbox token sent to production (or vice versa) fails like this. */
export function isWrongEnvironmentResult(result: ApnsResult): boolean {
  return !result.ok && result.reason === 'BadDeviceToken';
}
