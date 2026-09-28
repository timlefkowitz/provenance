import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * IDs of users the given user has blocked (guideline 1.2). Their content is
 * hidden from this user everywhere we list or show user content.
 *
 * Fails open to an empty set: a lookup error should degrade to "no blocks"
 * rather than breaking the feed.
 */
export async function getBlockedUserIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const { data, error } = await asUntyped(getSupabaseServerClient())
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) {
      console.error('[Moderation] getBlockedUserIds failed', error);
      return new Set();
    }
    return new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
  } catch (err) {
    console.error('[Moderation] getBlockedUserIds threw', err);
    return new Set();
  }
}

/** True if any of the content's owner ids is blocked. */
export function isOwnedByBlocked(
  blocked: Set<string>,
  ...ownerIds: (string | null | undefined)[]
): boolean {
  if (blocked.size === 0) return false;
  return ownerIds.some((id) => !!id && blocked.has(id));
}
