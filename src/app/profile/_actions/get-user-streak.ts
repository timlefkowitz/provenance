'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { StarTier } from '~/lib/streak-service';

export type UserStreakView = {
  currentStreakDays: number;
  longestStreakDays: number;
  dailyUploadCount: number;
  starTier: StarTier;
  isFoundingArtist: boolean;
};

export async function getUserStreak(userId: string): Promise<UserStreakView | null> {
  const client = getSupabaseServerClient();

  const [goalResult, badgeResult] = await Promise.all([
    client
      .from('user_goals')
      .select('current_streak_days, longest_streak_days, daily_upload_count, star_tier')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle(),
    client
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_type', 'founding_artist')
      .maybeSingle(),
  ]);

  if (goalResult.error) {
    console.error('[Streak] getUserStreak query failed', { userId, error: goalResult.error });
    return null;
  }

  if (!goalResult.data) {
    return null;
  }

  if (badgeResult.error) {
    console.error('[Streak] getUserStreak badge query failed', { userId, error: badgeResult.error });
  }

  return {
    currentStreakDays: goalResult.data.current_streak_days ?? 0,
    longestStreakDays: goalResult.data.longest_streak_days ?? 0,
    dailyUploadCount: goalResult.data.daily_upload_count ?? 0,
    starTier: (goalResult.data.star_tier ?? 'bronze') as StarTier,
    isFoundingArtist: !!badgeResult.data,
  };
}
