import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { hashClaimToken } from '~/lib/certificate-claims/tokens';

/**
 * An exhibition invite is reached two ways:
 * - the emailed token (`?token=…`), before or after the artist accepts;
 * - `invite:<id>`, used from the artist's show page once they've accepted, so
 *   the raw token (never stored) isn't needed again. Only the artist who
 *   accepted the invite may use it; callers check `accepted_by`.
 */
const INVITE_ID_PREFIX = 'invite:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inviteKeyForId(inviteId: string): string {
  return `${INVITE_ID_PREFIX}${inviteId}`;
}

export function parseInviteKey(
  key: string | null | undefined,
): { kind: 'token'; token: string } | { kind: 'id'; inviteId: string } | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(INVITE_ID_PREFIX)) {
    const id = trimmed.slice(INVITE_ID_PREFIX.length);
    return UUID_RE.test(id) ? { kind: 'id', inviteId: id } : null;
  }
  return { kind: 'token', token: trimmed };
}

/**
 * Loads an invite row by key with the admin client. `invite:<id>` keys only
 * resolve for accepted invites; the caller still checks the signed-in user.
 */
export async function findInviteByKey<T extends Record<string, unknown>>(
  adminClient: UntypedSupabaseClient,
  key: string,
  columns: string,
): Promise<{ invite: T | null; byId: boolean; error: unknown }> {
  const parsed = parseInviteKey(key);
  if (!parsed) return { invite: null, byId: false, error: null };

  let query = asUntyped(adminClient).from('exhibition_artist_invites').select(columns);
  query =
    parsed.kind === 'id'
      ? query.eq('id', parsed.inviteId).eq('status', 'accepted')
      : query.eq('token_hash', hashClaimToken(parsed.token));

  const { data, error } = await query.maybeSingle();
  return { invite: (data as T | null) ?? null, byId: parsed.kind === 'id', error };
}
