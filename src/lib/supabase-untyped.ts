/**
 * Utility for accessing Supabase tables not in the generated Database schema.
 *
 * Use `asUntyped(client)` to cast a typed client to a generic one that accepts
 * arbitrary table names and returns untyped query builders.
 * This avoids the `no-explicit-any` ESLint rule in call sites while enabling
 * queries on tables outside the generated Database type.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

export type UntypedSupabaseClient = SupabaseClient<any>;

export function asUntyped(client: unknown): UntypedSupabaseClient {
  return client as UntypedSupabaseClient;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
