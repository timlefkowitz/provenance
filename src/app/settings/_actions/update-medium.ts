'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function updateMedium(medium: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update your medium' };
    }

    // Get current account data
    const { data: account, error: fetchError } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching account:', fetchError);
      return { error: 'Failed to fetch account data' };
    }

    // Update public_data with medium
    const currentPublicData = (account?.public_data as Record<string, any>) || {};
    const updatedPublicData = {
      ...currentPublicData,
      medium: medium.trim() || null,
    };

    const { error } = await client
      .from('accounts')
      .update({
        public_data: updatedPublicData,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating medium:', error);
      return { error: error.message || 'Failed to update medium' };
    }

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    console.error('Error in updateMedium:', error);
    return { error: 'An unexpected error occurred' };
  }
}

