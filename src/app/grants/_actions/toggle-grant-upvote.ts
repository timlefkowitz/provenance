'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Toggle an upvote on a community grant.
 * Returns the new upvoted state and updated count.
 */
export async function toggleGrantUpvote(grantId: string, currentlyUpvoted: boolean) {
  console.log('[Grants] toggleGrantUpvote', { grantId, currentlyUpvoted });
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Grants] toggleGrantUpvote: not authenticated', authError);
    return { success: false, error: 'Not authenticated', upvoted: currentlyUpvoted };
  }

  if (currentlyUpvoted) {
    // Remove upvote
    const { error } = await (client as any)
      .from('grant_upvotes')
      .delete()
      .eq('grant_id', grantId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Grants] toggleGrantUpvote delete failed', error);
      return { success: false, error: error.message, upvoted: currentlyUpvoted };
    }
  } else {
    // Add upvote (ignore conflict — idempotent)
    const { error } = await (client as any)
      .from('grant_upvotes')
      .insert({ grant_id: grantId, user_id: user.id });

    if (error && error.code !== '23505') {
      // 23505 = unique_violation, safe to ignore
      console.error('[Grants] toggleGrantUpvote insert failed', error);
      return { success: false, error: error.message, upvoted: currentlyUpvoted };
    }
  }

  console.log('[Grants] toggleGrantUpvote success', { grantId, newUpvoted: !currentlyUpvoted });
  return { success: true, upvoted: !currentlyUpvoted };
}
