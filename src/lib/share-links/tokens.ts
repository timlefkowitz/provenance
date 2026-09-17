import { createHash, randomBytes } from 'crypto';

/**
 * Opaque URL-safe token (never store raw in DB; store hash only).
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
