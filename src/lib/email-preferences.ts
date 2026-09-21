import { createHmac } from 'crypto';
import { constantTimeEquals } from '~/lib/security/constant-time';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/**
 * Email opt-outs and the signed one-click unsubscribe link for the weekly digest.
 */

const TOKEN_LABEL = 'digest-unsubscribe';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signingKey(): string {
  const key = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!key) throw new Error('UNSUBSCRIBE_SECRET (or CRON_SECRET) must be set to sign unsubscribe links');
  return key;
}

function sign(userId: string): string {
  return createHmac('sha256', signingKey()).update(`${TOKEN_LABEL}:${userId}`).digest('base64url');
}

/** Stateless token: `<userId>.<hmac>`. No expiry — an unsubscribe link should keep working. */
export function signUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Returns the user id if the token is authentic, otherwise null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!UUID_RE.test(userId)) return null;
  try {
    return constantTimeEquals(signature, sign(userId)) ? userId : null;
  } catch {
    return null;
  }
}

/** Confirm-page link for the email body, and the RFC 8058 one-click endpoint for headers. */
export function digestUnsubscribeUrls(siteUrl: string, userId: string): { page: string; oneClick: string } {
  const base = siteUrl.replace(/\/$/, '');
  const token = encodeURIComponent(signUnsubscribeToken(userId));
  return {
    page: `${base}/unsubscribe/digest?token=${token}`,
    oneClick: `${base}/api/unsubscribe/digest?token=${token}`,
  };
}

/** Postgres "undefined_table" / PostgREST "not in schema cache": the migration is not applied yet. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

export type OptOutLookup =
  | { ready: true; optedOut: Set<string> }
  | { ready: false; reason: string };

/**
 * Which of these users have opted out of the digest. Fails closed: if the
 * preferences can't be read reliably, `ready` is false and the caller must not send.
 */
export async function getDigestOptOuts(admin: UntypedSupabaseClient, userIds: string[]): Promise<OptOutLookup> {
  if (userIds.length === 0) return { ready: true, optedOut: new Set() };
  const { data, error } = await admin
    .from('email_preferences')
    .select('user_id')
    .eq('digest_opt_out', true)
    .in('user_id', userIds);

  if (error) {
    return {
      ready: false,
      reason: isMissingTable(error)
        ? 'email_preferences table missing — apply migration 20260921000000_email_preferences.sql'
        : `could not read email_preferences: ${error.message}`,
    };
  }
  return { ready: true, optedOut: new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)) };
}

export async function setDigestOptOut(
  admin: UntypedSupabaseClient,
  userId: string,
  optOut: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const { error } = await admin.from('email_preferences').upsert(
    {
      user_id: userId,
      digest_opt_out: optOut,
      digest_opted_out_at: optOut ? now : null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.error('[EmailPreferences] setDigestOptOut failed', { userId, error });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
