'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

type ProfileExtrasPayload = {
  medium?: string;
  cv?: string;
  links?: string[];
  galleries?: string[];
};

export async function updateMedium(
  input: string | ProfileExtrasPayload,
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update your medium' };
    }

    const medium =
      typeof input === 'string'
        ? input
        : input.medium ?? ((account?.public_data as any)?.medium as string) ?? '';

    const cv = typeof input === 'string' ? undefined : input.cv;
    const links = typeof input === 'string' ? undefined : input.links;
    const galleries = typeof input === 'string' ? undefined : input.galleries;

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
    const currentPublicData =
      (account?.public_data as Record<string, any>) || {};
    const updatedPublicData: Record<string, any> = {
      ...currentPublicData,
      medium: medium.trim() || null,
    };

    if (cv !== undefined) {
      updatedPublicData.cv = cv.trim() || null;
    }

    if (links !== undefined) {
      const cleanedLinks = links
        .map((l) => l.trim())
        .filter(Boolean);
      updatedPublicData.links = cleanedLinks.length > 0 ? cleanedLinks : null;
    }

    if (galleries !== undefined) {
      const cleanedGalleries = galleries
        .map((g) => g.trim())
        .filter(Boolean);
      updatedPublicData.galleries =
        cleanedGalleries.length > 0 ? cleanedGalleries : null;
    }

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

