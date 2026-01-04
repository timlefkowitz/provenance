'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function checkIsFollowing(artistId: string, currentUserId: string): Promise<boolean> {
  try {
    const client = getSupabaseServerClient();

    const { data } = await client
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', artistId)
      .single();

    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

