'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

export async function revokeArtworkShare(shareId: string): Promise<{ success: boolean; error?: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const adminClient = asUntyped(getSupabaseServerAdminClient());

  const { data: share, error: fetchError } = await adminClient
    .from('artwork_shares')
    .select('id, account_id')
    .eq('id', shareId)
    .single();

  if (fetchError || !share || share.account_id !== user.id) {
    return { success: false, error: 'Share not found' };
  }

  const { error: updateError } = await adminClient
    .from('artwork_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId);

  if (updateError) {
    console.error('[Shares] revokeArtworkShare failed', updateError);
    return { success: false, error: 'Could not revoke share link' };
  }

  return { success: true };
}
