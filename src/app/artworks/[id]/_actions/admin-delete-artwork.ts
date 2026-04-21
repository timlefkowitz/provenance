'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

/**
 * Admin-only: delete any artwork regardless of ownership.
 */
export async function adminDeleteArtwork(artworkId: string) {
  console.log('[AdminDeleteArtwork] started', { artworkId });

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

  // Delete the artwork
  const { error: deleteError } = await (client as any)
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
