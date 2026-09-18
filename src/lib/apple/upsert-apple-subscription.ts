import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/**
 * Inserts or updates the subscriptions row for an Apple transaction, keyed on
 * `apple_original_transaction_id`.
 *
 * Deliberately not `.upsert({ onConflict })`: the unique index on that column
 * is partial (`where apple_original_transaction_id is not null`), and Postgres
 * can't infer a partial index from a bare ON CONFLICT (column) — it fails with
 * 42P10 "no unique or exclusion constraint matching the ON CONFLICT
 * specification". supabase-js can't express the index predicate, so do the
 * select/insert/update ourselves.
 */
export async function upsertAppleSubscription(
  admin: UntypedSupabaseClient,
  row: Record<string, unknown> & { apple_original_transaction_id: string },
): Promise<{ error: { message: string; code?: string } | null }> {
  const key = row.apple_original_transaction_id;

  const update = async () => {
    const { error } = await admin.from('subscriptions').update(row).eq('apple_original_transaction_id', key);
    return { error };
  };

  const { data: existing, error: lookupError } = await admin
    .from('subscriptions')
    .select('id')
    .eq('apple_original_transaction_id', key)
    .maybeSingle();
  if (lookupError) return { error: lookupError };
  if (existing) return update();

  const { error: insertError } = await admin.from('subscriptions').insert(row);
  // Eager sync and the App Store webhook can race to create the same row; the
  // loser hits the unique index (23505) and should just update it.
  if (insertError?.code === '23505') return update();
  return { error: insertError };
}
