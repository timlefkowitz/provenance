import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Accounts flagged `public_data.hidden_from_directory = true` (e.g. the Apple
 * App Review demo accounts) are left out of public listings — the registry
 * and the artworks feed. Their own pages still work, and their owners still
 * see their own content.
 *
 * Uses the admin client because accounts' RLS doesn't expose other users'
 * public_data to every viewer. Fails open (empty set) so a lookup error
 * never empties the registry.
 */
export async function getDirectoryHiddenAccountIds(): Promise<Set<string>> {
  try {
    const { data, error } = await asUntyped(getSupabaseServerAdminClient())
      .from('accounts')
      .select('id')
      .eq('public_data->>hidden_from_directory', 'true');
    if (error) {
      console.error('[Directory] hidden accounts lookup failed', error);
      return new Set();
    }
    return new Set((data ?? []).map((r: { id: string }) => r.id));
  } catch (err) {
    console.error('[Directory] hidden accounts lookup threw', err);
    return new Set();
  }
}
