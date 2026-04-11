import type { DbClient } from '../db/client';

export interface ApiKeyRecord {
  id: string;
  account_id: string;
  key_hash: string;
  name: string;
  scopes: string[];
  planet: string | null;
  rate_limit: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

/**
 * Validates a bearer token against the api_keys table.
 * Returns the key record if valid, null otherwise.
 */
export async function validateApiKey(
  client: DbClient,
  keyHash: string,
): Promise<ApiKeyRecord | null> {
  const { data, error } = await client
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  await client
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data as ApiKeyRecord;
}
