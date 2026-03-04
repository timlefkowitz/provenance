/**
 * Lightweight per-IP rate limiting for API routes.
 * In-memory, per-process; suitable for serverless. For strict DoS control use Redis or edge config.
 */

const store = new Map<string, { count: number; ts: number }>();

const DEFAULT_WINDOW_MS = 60_000;

export type RateLimitOptions = {
  windowMs?: number;
  maxPerWindow?: number;
  keyPrefix?: string;
};

/**
 * Returns true if the request is within limit; false if over limit.
 * Caller should return 429 when false.
 */
export function checkRateLimit(
  request: { ip?: string | null; headers: Headers },
  options: RateLimitOptions = {},
): boolean {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxPerWindow = 60,
    keyPrefix = 'default',
  } = options;

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  const existing = store.get(key);
  if (!existing || now - existing.ts > windowMs) {
    store.set(key, { count: 1, ts: now });
    return true;
  }
  if (existing.count >= maxPerWindow) {
    return false;
  }
  existing.count += 1;
  return true;
}
