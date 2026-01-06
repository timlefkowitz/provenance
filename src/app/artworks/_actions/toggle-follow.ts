'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function toggleFollow(artistId: string, currentUserId: string) {
  try {
    const client = getSupabaseServerClient();

    // Check if already following
    const { data: existing } = await client
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', artistId)
      .single();

    if (existing) {
      // Unfollow
      const { error } = await client
        .from('user_follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', artistId);

      if (error) {
        console.error('Error unfollowing:', error);
        return { error: 'Failed to unfollow' };
      }

      revalidatePath('/artworks');
      return { isFollowing: false };
    } else {
      // Follow
      const { error } = await client
        .from('user_follows')
        .insert({
          follower_id: currentUserId,
          following_id: artistId,
        });

      if (error) {
        console.error('Error following:', error);
        return { error: 'Failed to follow' };
      }

      revalidatePath('/artworks');
      return { isFollowing: true };
    }
  } catch (error) {
    console.error('Error in toggleFollow:', error);
    return { error: 'An unexpected error occurred' };
  }
}

