import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

export type StarTier = 'bronze' | 'silver' | 'gold';
export type StreakActivityType = 'daily_activity' | 'artwork_uploaded' | 'artwork_favorited';

export type UserStreakRecord = {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
  daily_upload_count: number;
  daily_upload_date: string | null;
  has_daily_upload_bonus: boolean;
  star_tier: StarTier;
  daily_favorite_count: number;
  daily_favorite_date: string | null;
  has_daily_favorite_bonus: boolean;
};

export type TrackStreakInput = {
  userId: string;
  activityType: StreakActivityType;
  eventDate?: Date;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getYesterdayDateKey(date: Date): string {
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return toDateKey(yesterday);
}

export function getStarTier(streakDays: number): StarTier {
  if (streakDays >= 8) return 'gold';
  if (streakDays >= 4) return 'silver';
  return 'bronze';
}

export function calculateNextStreakState(
  current: UserStreakRecord,
  activityType: StreakActivityType,
  eventDate: Date,
): Omit<UserStreakRecord, 'user_id'> {
  const today = toDateKey(eventDate);
  const yesterday = getYesterdayDateKey(eventDate);

  let currentStreakDays = current.current_streak_days ?? 0;
  let longestStreakDays = current.longest_streak_days ?? 0;
  let lastActiveDate = current.last_active_date;

  if (!lastActiveDate) {
    currentStreakDays = 1;
    lastActiveDate = today;
  } else if (lastActiveDate === today) {
    // Idempotent same-day activity.
  } else if (lastActiveDate === yesterday) {
    currentStreakDays += 1;
    lastActiveDate = today;
  } else {
    currentStreakDays = 1;
    lastActiveDate = today;
  }

  let dailyUploadDate = current.daily_upload_date;
  let dailyUploadCount = current.daily_upload_count ?? 0;
  let hasDailyUploadBonus = current.has_daily_upload_bonus ?? false;

  if (dailyUploadDate !== today) {
    dailyUploadDate = today;
    dailyUploadCount = 0;
    hasDailyUploadBonus = false;
  }

  if (activityType === 'artwork_uploaded') {
    dailyUploadCount += 1;

    // First time a user reaches 3 uploads in a day, grant a one-time streak boost.
    if (!hasDailyUploadBonus && dailyUploadCount >= 3) {
      currentStreakDays += 1;
      hasDailyUploadBonus = true;
    }
  }

  // Favorite bonus: track daily favorites; 5 in a day = one-time +1 streak boost.
  let dailyFavoriteDate = current.daily_favorite_date;
  let dailyFavoriteCount = current.daily_favorite_count ?? 0;
  let hasDailyFavoriteBonus = current.has_daily_favorite_bonus ?? false;

  if (dailyFavoriteDate !== today) {
    dailyFavoriteDate = today;
    dailyFavoriteCount = 0;
    hasDailyFavoriteBonus = false;
  }

  if (activityType === 'artwork_favorited') {
    dailyFavoriteCount += 1;

    if (!hasDailyFavoriteBonus && dailyFavoriteCount >= 5) {
      currentStreakDays += 1;
      hasDailyFavoriteBonus = true;
    }
  }

  longestStreakDays = Math.max(longestStreakDays, currentStreakDays);

  return {
    current_streak_days: currentStreakDays,
    longest_streak_days: longestStreakDays,
    last_active_date: lastActiveDate,
    daily_upload_count: dailyUploadCount,
    daily_upload_date: dailyUploadDate,
    has_daily_upload_bonus: hasDailyUploadBonus,
    daily_favorite_count: dailyFavoriteCount,
    daily_favorite_date: dailyFavoriteDate,
    has_daily_favorite_bonus: hasDailyFavoriteBonus,
    star_tier: getStarTier(currentStreakDays),
  };
}

async function getOrCreateUserStreak(
  client: SupabaseClient,
  userId: string,
): Promise<UserStreakRecord> {
  const { data, error } = await client
    .from('user_streaks')
    .select(
      'user_id, current_streak_days, longest_streak_days, last_active_date, daily_upload_count, daily_upload_date, has_daily_upload_bonus, star_tier, daily_favorite_count, daily_favorite_date, has_daily_favorite_bonus',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as UserStreakRecord;
  }

  const initial: UserStreakRecord = {
    user_id: userId,
    current_streak_days: 0,
    longest_streak_days: 0,
    last_active_date: null,
    daily_upload_count: 0,
    daily_upload_date: null,
    has_daily_upload_bonus: false,
    star_tier: 'bronze',
    daily_favorite_count: 0,
    daily_favorite_date: null,
    has_daily_favorite_bonus: false,
  };

  const { data: created, error: insertError } = await client
    .from('user_streaks')
    .insert(initial)
    .select(
      'user_id, current_streak_days, longest_streak_days, last_active_date, daily_upload_count, daily_upload_date, has_daily_upload_bonus, star_tier, daily_favorite_count, daily_favorite_date, has_daily_favorite_bonus',
    )
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error('Failed to create user streak record');
  }

  return created as UserStreakRecord;
}

export async function trackUserStreakActivity(
  client: SupabaseClient,
  input: TrackStreakInput,
): Promise<UserStreakRecord> {
  console.log('[Streak] trackUserStreakActivity started', {
    userId: input.userId,
    activityType: input.activityType,
  });
  logger.info('streak_track_started', {
    userId: input.userId,
    activityType: input.activityType,
  });

  try {
    console.log('[Streak] Fetching current user streak');
    const current = await getOrCreateUserStreak(client, input.userId);
    const nextState = calculateNextStreakState(
      current,
      input.activityType,
      input.eventDate ?? new Date(),
    );

    console.log('[Streak] Persisting user streak update');
    const { data, error } = await client
      .from('user_streaks')
      .update(nextState)
      .eq('user_id', input.userId)
      .select(
        'user_id, current_streak_days, longest_streak_days, last_active_date, daily_upload_count, daily_upload_date, has_daily_upload_bonus, star_tier, daily_favorite_count, daily_favorite_date, has_daily_favorite_bonus',
      )
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to persist streak state');
    }

    console.log('[Streak] User streak updated successfully');
    logger.info('streak_track_succeeded', {
      userId: input.userId,
      activityType: input.activityType,
      currentStreakDays: data.current_streak_days,
      starTier: data.star_tier,
      dailyUploadCount: data.daily_upload_count,
    });

    return data as UserStreakRecord;
  } catch (error) {
    console.error('[Streak] trackUserStreakActivity failed', error);
    logger.error('streak_track_failed', {
      userId: input.userId,
      activityType: input.activityType,
      error,
    });
    throw error;
  }
}
