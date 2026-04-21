'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';

/**
 * Admin-only: delete any artwork regardless of ownership.
 * Uses the service-role admin client to bypass RLS (the artworks DELETE policy
 * only allows the owner to delete their own rows via the regular authed client).
 */
export async function adminDeleteArtwork(artworkId: string) {
  console.log('[AdminDeleteArtwork] started', { artworkId });

  // Verify the caller is authenticated
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify the caller is an admin
  const { data: account, error: accountError } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (accountError || !account) {
    console.error('[AdminDeleteArtwork] could not load account', accountError);
    throw new Error('Could not verify account');
  }

  const publicData = account.public_data as Record<string, unknown> | null;
  if (!publicData || publicData.admin !== true) {
    throw new Error('Forbidden: admin access required');
  }

  // Use the service-role admin client so RLS is bypassed — the regular
  // authed client would silently no-op because the admin is not the owner.
  const adminClient = getSupabaseServerAdminClient();
  const { error: deleteError } = await (adminClient as any)
    .from('artworks')
    .delete()
    .eq('id', artworkId);

  if (deleteError) {
    console.error('[AdminDeleteArtwork] delete failed', deleteError);
    throw new Error(`Failed to delete artwork: ${deleteError.message}`);
  }

  console.log('[AdminDeleteArtwork] artwork deleted', { artworkId });

  revalidatePath('/artworks');
  revalidatePath('/notifications');

  return { success: true };
}
