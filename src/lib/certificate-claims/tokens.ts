import { createHash, randomBytes } from 'crypto';

/**
 * Opaque URL-safe token (never store raw in DB; store hash only).
 */
export function generateClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeInviteEmail(a) === normalizeInviteEmail(b);
}
