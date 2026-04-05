'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { StarTier } from '~/lib/streak-service';

export type UserStreakView = {
  currentStreakDays: number;
  longestStreakDays: number;
  dailyUploadCount: number;
  starTier: StarTier;
};

export async function getUserStreak(userId: string): Promise<UserStreakView | null> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('user_streaks')
    .select('current_streak_days, longest_streak_days, daily_upload_count, star_tier')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Streak] getUserStreak query failed', { userId, error });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    currentStreakDays: data.current_streak_days ?? 0,
    longestStreakDays: data.longest_streak_days ?? 0,
    dailyUploadCount: data.daily_upload_count ?? 0,
    starTier: (data.star_tier ?? 'bronze') as StarTier,
  };
}
