import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getServiceClient } from '~/lib/supabase';

export interface AuthenticatedRequest {
  accountId: string;
  keyId: string;
  scopes: string[];
  planet: string | null;
  rateLimit: number;
}

// ---------------------------------------------------------------------------
// Distributed rate limiter for API key requests (per keyId, per hour).
// Backed by Upstash Redis so limits hold across serverless instances and
// cold starts; falls back to a per-process in-memory Map only when the
// Upstash env vars are absent (local development).
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkMemRateLimit(keyId: string, limitPerHour: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(keyId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(keyId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limitPerHour) {
    return false;
  }

  entry.count += 1;
  return true;
}

let upstashRedis: Redis | null = null;
// Cache Ratelimit instances per limit value to avoid re-creating them.
const rlCache = new Map<number, Ratelimit>();

function getUpstashRatelimit(limitPerHour: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cached = rlCache.get(limitPerHour);
  if (cached) return cached;

  if (!upstashRedis) {
    upstashRedis = new Redis({ url, token });
  }

  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(limitPerHour, '3600 s'),
    prefix: 'api-key-rl',
    analytics: false,
  });

  rlCache.set(limitPerHour, limiter);
  return limiter;
}

async function checkApiKeyRateLimit(
  keyId: string,
  limitPerHour: number,
): Promise<boolean> {
  const upstash = getUpstashRatelimit(limitPerHour);

  if (upstash) {
    try {
      const { success } = await upstash.limit(keyId);
      return success;
    } catch (err) {
      // If Redis is unreachable, degrade gracefully to in-memory limiting.
      console.error('[API/auth] Upstash error, falling back to in-memory', err);
    }
  }

  return checkMemRateLimit(keyId, limitPerHour);
}

// ---------------------------------------------------------------------------
// Scope helpers
// ---------------------------------------------------------------------------

/**
 * Returns a 403 response if the authenticated request lacks the required scope.
 * Returns null if the scope is present.
 */
export function requireScope(
  auth: AuthenticatedRequest,
  scope: string,
): NextResponse | null {
  if (!auth.scopes.includes(scope)) {
    console.warn('[API/auth] Insufficient scope', { keyId: auth.keyId, required: scope, has: auth.scopes });
    return NextResponse.json(
      { error: `Insufficient scope. Required: "${scope}".` },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Returns a 403 response if the API key is scoped to a specific planet that
 * does not match the requested planet. Returns null if scoping allows it.
 */
export function requirePlanet(
  auth: AuthenticatedRequest,
  planet: string,
): NextResponse | null {
  if (auth.planet && auth.planet !== planet) {
    console.warn('[API/auth] Planet mismatch', { keyId: auth.keyId, keyPlanet: auth.planet, requested: planet });
    return NextResponse.json(
      { error: `API key is scoped to planet "${auth.planet}" but request targets "${planet}".` },
      { status: 403 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main authenticator
// ---------------------------------------------------------------------------

/**
 * Authenticates an API request via Bearer token and enforces per-key rate limits.
 * Returns the authenticated context or an error NextResponse.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedRequest | NextResponse> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
      { status: 401 },
    );
  }

  const apiKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const client = getServiceClient();

  const { data, error } = await client
    .from('api_keys')
    .select('id, account_id, scopes, planet, rate_limit, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data || !data.is_active) {
    return NextResponse.json(
      { error: 'Invalid or inactive API key' },
      { status: 401 },
    );
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'API key has expired' },
      { status: 401 },
    );
  }

  const limitPerHour: number = data.rate_limit ?? 1000;
  if (!(await checkApiKeyRateLimit(data.id, limitPerHour))) {
    const retryAfterSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    console.warn('[API/auth] Rate limit exceeded', { keyId: data.id, limitPerHour });
    return NextResponse.json(
      { error: `Rate limit exceeded. Limit: ${limitPerHour} requests/hour.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  await client
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    accountId: data.account_id,
    keyId: data.id,
    scopes: data.scopes ?? [],
    planet: data.planet,
    rateLimit: limitPerHour,
  };
}

export function isAuthError(result: AuthenticatedRequest | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
