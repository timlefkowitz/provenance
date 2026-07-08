/**
 * Distributed rate limiting backed by Upstash Redis when env vars are present,
 * falling back to a per-process in-memory Map for local development.
 *
 * Usage:
 *   const allowed = await checkRateLimit(request, { keyPrefix: 'my-route', maxPerWindow: 60 });
 *   if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type RateLimitOptions = {
  windowMs?: number;
  maxPerWindow?: number;
  keyPrefix?: string;
};

// ---------------------------------------------------------------------------
// In-memory fallback (used when Upstash env vars are absent)
// ---------------------------------------------------------------------------

const memStore = new Map<string, { count: number; ts: number }>();

function checkMemRateLimit(
  key: string,
  windowMs: number,
  maxPerWindow: number,
): boolean {
  const now = Date.now();
  const existing = memStore.get(key);
  if (!existing || now - existing.ts > windowMs) {
    memStore.set(key, { count: 1, ts: now });
    return true;
  }
  if (existing.count >= maxPerWindow) {
    return false;
  }
  existing.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Upstash client (lazily initialised once per process)
// ---------------------------------------------------------------------------

let upstashRedis: Redis | null = null;
// Cache Ratelimit instances per window configuration to avoid re-creating them.
const rlCache = new Map<string, Ratelimit>();

function getUpstashRatelimit(windowMs: number, maxPerWindow: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${windowMs}:${maxPerWindow}`;
  if (rlCache.has(cacheKey)) return rlCache.get(cacheKey)!;

  if (!upstashRedis) {
    upstashRedis = new Redis({ url, token });
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(maxPerWindow, `${windowSeconds} s`),
    analytics: false,
  });

  rlCache.set(cacheKey, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60_000;

/**
 * Returns true if the request is within the rate limit; false if over limit.
 * Call with `await`; caller should return 429 when false.
 *
 * The identifier key is derived from keyPrefix + the client IP. When the request
 * carries a user-specific prefix (e.g. `heartbeat:${user.id}`) the IP is not appended
 * so that authenticated limits are per-user regardless of IP.
 */
export async function checkRateLimit(
  request: { ip?: string | null; headers: Headers | { get(name: string): string | null } },
  options: RateLimitOptions = {},
): Promise<boolean> {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxPerWindow = 60,
    keyPrefix = 'default',
  } = options;

  // If keyPrefix already includes a user-specific segment (contains ':') we use
  // it as-is; otherwise append the client IP for IP-based limiting.
  const ip =
    (request as { ip?: string | null }).ip ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const key = keyPrefix.includes(':') ? keyPrefix : `${keyPrefix}:${ip}`;

  const upstash = getUpstashRatelimit(windowMs, maxPerWindow);
  if (upstash) {
    try {
      const { success } = await upstash.limit(key);
      return success;
    } catch (err) {
      // If Redis is unreachable, degrade gracefully to in-memory.
      console.error('[RateLimit] Upstash error, falling back to in-memory', err);
    }
  }

  return checkMemRateLimit(key, windowMs, maxPerWindow);
}
