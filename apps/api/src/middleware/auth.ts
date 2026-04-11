import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServiceClient } from '~/lib/supabase';

export interface AuthenticatedRequest {
  accountId: string;
  keyId: string;
  scopes: string[];
  planet: string | null;
  rateLimit: number;
}

/**
 * Authenticates an API request via Bearer token.
 * Returns the authenticated context or a 401 response.
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

  await client
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    accountId: data.account_id,
    keyId: data.id,
    scopes: data.scopes ?? [],
    planet: data.planet,
    rateLimit: data.rate_limit ?? 1000,
  };
}

export function isAuthError(result: AuthenticatedRequest | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
