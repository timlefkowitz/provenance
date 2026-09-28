import { createSign } from 'node:crypto';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Sign in with Apple token revocation (App Store guideline 5.1.1(v)).
 *
 * Requires these env vars (Apple Developer → Certificates, Identifiers &
 * Profiles → Keys, a key with "Sign in with Apple" enabled):
 *   APPLE_SIGNIN_TEAM_ID      — 10-char Team ID
 *   APPLE_SIGNIN_CLIENT_ID    — the Services ID configured as the Apple
 *                               provider's client ID in Supabase
 *   APPLE_SIGNIN_KEY_ID       — the key's 10-char Key ID
 *   APPLE_SIGNIN_PRIVATE_KEY  — contents of the AuthKey_<KeyID>.p8 file
 *                               (literal "\n" sequences are accepted)
 */

function getConfig() {
  const teamId = process.env.APPLE_SIGNIN_TEAM_ID?.trim();
  const clientId = process.env.APPLE_SIGNIN_CLIENT_ID?.trim();
  const keyId = process.env.APPLE_SIGNIN_KEY_ID?.trim();
  const privateKey = process.env.APPLE_SIGNIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!teamId || !clientId || !keyId || !privateKey) return null;
  return { teamId, clientId, keyId, privateKey };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** ES256 client secret JWT Apple expects on /auth/revoke (valid 5 minutes). */
export function buildAppleClientSecret(config: NonNullable<ReturnType<typeof getConfig>>, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: nowSeconds,
      exp: nowSeconds + 300,
      aud: 'https://appleid.apple.com',
      sub: config.clientId,
    }),
  );
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${base64url(signature)}`;
}

/**
 * Called from the OAuth callback. Apple only hands out the refresh token at
 * sign-in, so persist it for later revocation. Best-effort; never throws.
 */
export async function storeAppleRefreshToken(session: Session | null | undefined): Promise<void> {
  try {
    if (!session?.user || session.user.app_metadata?.provider !== 'apple') return;
    const refreshToken = session.provider_refresh_token;
    if (!refreshToken) {
      console.warn('[SignInWithApple] no provider_refresh_token on Apple session', { userId: session.user.id });
      return;
    }
    const { error } = await asUntyped(getSupabaseServerAdminClient())
      .from('apple_signin_tokens')
      .upsert(
        { user_id: session.user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) console.error('[SignInWithApple] store refresh token failed', { userId: session.user.id, error });
    else console.log('[SignInWithApple] refresh token stored', { userId: session.user.id });
  } catch (err) {
    console.error('[SignInWithApple] store refresh token threw', err);
  }
}

/**
 * Called from deleteAccount before the auth user is removed. Revokes the
 * stored token with Apple so the app disappears from the user's "Sign in with
 * Apple" list. Best-effort: logs and returns false rather than blocking the
 * deletion the user asked for.
 */
export async function revokeAppleSignIn(userId: string): Promise<boolean> {
  try {
    const admin = asUntyped(getSupabaseServerAdminClient());
    const { data: row } = await admin
      .from('apple_signin_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle();
    if (!row?.refresh_token) return false;

    const config = getConfig();
    if (!config) {
      console.error('[SignInWithApple] revoke skipped — APPLE_SIGNIN_* env vars not set', { userId });
      return false;
    }

    const res = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: buildAppleClientSecret(config, Math.floor(Date.now() / 1000)),
        token: row.refresh_token,
        token_type_hint: 'refresh_token',
      }),
    });
    if (!res.ok) {
      console.error('[SignInWithApple] revoke failed', { userId, status: res.status, body: (await res.text()).slice(0, 300) });
      return false;
    }
    await admin.from('apple_signin_tokens').delete().eq('user_id', userId);
    console.log('[SignInWithApple] token revoked', { userId });
    return true;
  } catch (err) {
    console.error('[SignInWithApple] revoke threw', err);
    return false;
  }
}
