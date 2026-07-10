'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Delete a proposal document (owner only).
 */
export async function deleteProposal(id: string) {
  console.log('[Proposals] deleteProposal', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Proposals] deleteProposal: not authenticated', authError);
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await asUntyped(client)
    .from('grant_proposals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Proposals] deleteProposal failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Proposals] deleteProposal success', id);
  return { success: true };
}
