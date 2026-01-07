'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { revalidatePath } from 'next/cache';

export async function updateFeaturedEntry(featuredEntry: {
  artwork_id: string | null;
  title: string;
  description: string;
  link_url: string;
  image_url: string | null;
}) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to update featured entry' };
    }

    // If artwork_id is provided, fetch artwork details
    let finalImageUrl = featuredEntry.image_url;
    let finalLinkUrl = featuredEntry.link_url;

    if (featuredEntry.artwork_id) {
      const { data: artwork, error: artworkError } = await (client as any)
        .from('artworks')
        .select('id, title, image_url')
        .eq('id', featuredEntry.artwork_id)
        .single();

      if (!artworkError && artwork) {
        // Use artwork image if available
        if (artwork.image_url) {
          finalImageUrl = artwork.image_url;
        }
        // If no link_url provided, link to artwork certificate
        if (!finalLinkUrl) {
          finalLinkUrl = `/artworks/${artwork.id}/certificate`;
        }
      }
    }

    // Get current account data
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const currentPublicData = (account.public_data as Record<string, any>) || {};

    // Update public_data with featured entry
    const { error } = await client
      .from('accounts')
      .update({
        public_data: {
          ...currentPublicData,
          featured_entry: {
            artwork_id: featuredEntry.artwork_id,
            title: featuredEntry.title,
            description: featuredEntry.description,
            link_url: finalLinkUrl,
            image_url: finalImageUrl,
          },
        },
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating featured entry:', error);
      return { error: error.message || 'Failed to update featured entry' };
    }

    revalidatePath('/');
    revalidatePath('/admin');

    return { success: true };
  } catch (error) {
    console.error('Error in updateFeaturedEntry:', error);
    return { error: 'An unexpected error occurred' };
  }
}

