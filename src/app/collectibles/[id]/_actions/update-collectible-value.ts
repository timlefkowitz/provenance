'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

/**
 * Update the owner-declared value (and its privacy) for a collectible.
 * Uses the authenticated client so RLS ensures only the owner can update.
 */
export async function updateCollectibleValue(
  collectibleId: string,
  value: string,
  valueIsPublic: boolean,
) {
  console.log('[Collectibles] updateCollectibleValue started', { collectibleId, valueIsPublic });

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update a value.' };
    }

    const { error } = await asUntyped(client)
      .from('collectibles')
      .update({
        value: value.trim() || null,
        value_is_public: valueIsPublic,
        updated_by: user.id,
      })
      .eq('id', collectibleId)
      .eq('account_id', user.id);

    if (error) {
      console.error('[Collectibles] updateCollectibleValue failed', error);
      return { error: `Failed to update value: ${error.message}` };
    }

    console.log('[Collectibles] value updated', { collectibleId });
    revalidatePath(`/collectibles/${collectibleId}/certificate`);
    revalidatePath('/collectibles/my');
    revalidatePath('/portal');
    return { success: true };
  } catch (err) {
    console.error('[Collectibles] updateCollectibleValue error', err);
    return { error: (err as Error)?.message || 'An unexpected error occurred' };
  }
}
