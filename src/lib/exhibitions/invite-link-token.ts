import { createHmac, randomBytes } from 'crypto';

/**
 * Exhibition invite tokens derived from the invite id and a per-invite nonce
 * with a server secret, so an organiser can copy the same invite link again
 * without the raw token ever being stored. The database keeps only the
 * token's SHA-256 hash (hashClaimToken), as for every other invite.
 *
 * Changing the secret invalidates every derived link that hasn't been
 * accepted yet (accepted artists reach their show page by account instead).
 */
const LABEL = 'exhibition-invite-link';

function signingKey(): string {
  const key =
    process.env.EXHIBITION_INVITE_SECRET || process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!key) {
    throw new Error('EXHIBITION_INVITE_SECRET (or CRON_SECRET) must be set to make invite links');
  }
  return key;
}

export function newInviteTokenNonce(): string {
  return randomBytes(12).toString('base64url');
}

export function deriveInviteToken(inviteId: string, nonce: string): string {
  return createHmac('sha256', signingKey()).update(`${LABEL}:${inviteId}:${nonce}`).digest('base64url');
}
