import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for secrets (cron tokens, API secrets).
 *
 * Prevents timing side-channel attacks that `a === b` string comparison
 * allows. Both inputs are hashed to fixed-length digests first, so the
 * comparison time is independent of both content and length, and length
 * inequality does not leak where a mismatch occurred.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}
