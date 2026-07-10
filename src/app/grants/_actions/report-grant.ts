'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Submit a moderation report for a community grant.
 */
export async function reportGrant(grantId: string, reason: string) {
  console.log('[Grants] reportGrant', { grantId, reason: reason.slice(0, 80) });
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Grants] reportGrant: not authenticated', authError);
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await asUntyped(client)
    .from('grant_reports')
    .insert({ grant_id: grantId, user_id: user.id, reason: reason.trim() });

  if (error) {
    console.error('[Grants] reportGrant failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Grants] reportGrant success', grantId);
  return { success: true };
}
