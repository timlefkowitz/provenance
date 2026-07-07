import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

export type StarTier = 'bronze' | 'silver' | 'gold';

/**
 * What kind of activity generated a "commit" on a given day.
 * artwork_uploaded is weighted higher than a plain check-in since
 * certifying/uploading a piece is a bigger signal of art-career activity.
 */
export type CommitSource =
  | 'manual_checkin'
  | 'goal_checkin'
  | 'daily_activity'
  | 'artwork_uploaded'
  | 'artwork_favorited';

/** Legacy alias: these three sources drive the default ("overall activity") goal. */
export type StreakActivityType = 'daily_activity' | 'artwork_uploaded' | 'artwork_favorited';

export const COMMIT_WEIGHTS: Record<CommitSource, number> = {
  manual_checkin: 1,
  goal_checkin: 1,
  daily_activity: 1,
  artwork_favorited: 1,
  artwork_uploaded: 3,
};

const DEFAULT_GOAL_TITLE = 'Working on my art';
const DEFAULT_GOAL_EMOJI = '🎨';

export type UserGoalRecord = {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  is_default: boolean;
  is_archived: boolean;
  current_streak_days: number;
  longest_streak_days: number;
  last_checkin_date: string | null;
  star_tier: StarTier;
  daily_upload_count: number;
  daily_upload_date: string | null;
  has_daily_upload_bonus: boolean;
  daily_favorite_count: number;
  daily_favorite_date: string | null;
  has_daily_favorite_bonus: boolean;
};

/** @deprecated kept for backward compatibility; use UserGoalRecord */
export type UserStreakRecord = UserGoalRecord;

export type TrackStreakInput = {
  userId: string;
  activityType: StreakActivityType;
  eventDate?: Date;
};

const GOAL_COLUMNS =
  'id, user_id, title, emoji, is_default, is_archived, current_streak_days, longest_streak_days, last_checkin_date, star_tier, daily_upload_count, daily_upload_date, has_daily_upload_bonus, daily_favorite_count, daily_favorite_date, has_daily_favorite_bonus';

export function toDateKey(date: Date): string {
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

type GoalStreakState = {
  current_streak_days: number;
  longest_streak_days: number;
  last_checkin_date: string | null;
  star_tier: StarTier;
};

/**
 * Generic day-based streak increment, shared by the default goal and
 * user-created custom goals: +1 for a consecutive day, reset to 1 after
 * a missed day, idempotent for repeat check-ins on the same day.
 */
export function calculateNextGoalStreakState(
  current: Pick<GoalStreakState, 'current_streak_days' | 'longest_streak_days' | 'last_checkin_date'>,
  eventDate: Date,
): GoalStreakState {
  const today = toDateKey(eventDate);
  const yesterday = getYesterdayDateKey(eventDate);

  let currentStreakDays = current.current_streak_days ?? 0;
  let longestStreakDays = current.longest_streak_days ?? 0;
  let lastCheckinDate = current.last_checkin_date;

  if (!lastCheckinDate) {
    currentStreakDays = 1;
    lastCheckinDate = today;
  } else if (lastCheckinDate === today) {
    // Idempotent same-day activity.
  } else if (lastCheckinDate === yesterday) {
    currentStreakDays += 1;
    lastCheckinDate = today;
  } else {
    currentStreakDays = 1;
    lastCheckinDate = today;
  }

  longestStreakDays = Math.max(longestStreakDays, currentStreakDays);

  return {
    current_streak_days: currentStreakDays,
    longest_streak_days: longestStreakDays,
    last_checkin_date: lastCheckinDate,
    star_tier: getStarTier(currentStreakDays),
  };
}

/**
 * Default-goal-specific state transition: applies the generic day streak
 * plus the upload/favorite daily bonuses that only make sense for the
 * overall "did you engage with your art career today" goal.
 */
export function calculateNextDefaultGoalState(
  current: UserGoalRecord,
  activityType: StreakActivityType,
  eventDate: Date,
): Omit<UserGoalRecord, 'id' | 'user_id' | 'title' | 'emoji' | 'is_default' | 'is_archived'> {
  const today = toDateKey(eventDate);
  const dayState = calculateNextGoalStreakState(current, eventDate);

  let currentStreakDays = dayState.current_streak_days;
  let longestStreakDays = dayState.longest_streak_days;

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
    last_checkin_date: dayState.last_checkin_date,
    daily_upload_count: dailyUploadCount,
    daily_upload_date: dailyUploadDate,
    has_daily_upload_bonus: hasDailyUploadBonus,
    daily_favorite_count: dailyFavoriteCount,
    daily_favorite_date: dailyFavoriteDate,
    has_daily_favorite_bonus: hasDailyFavoriteBonus,
    star_tier: getStarTier(currentStreakDays),
  };
}

async function getOrCreateDefaultGoal(
  client: SupabaseClient,
  userId: string,
): Promise<UserGoalRecord> {
  const { data, error } = await client
    .from('user_goals')
    .select(GOAL_COLUMNS)
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as UserGoalRecord;
  }

  const initial = {
    user_id: userId,
    title: DEFAULT_GOAL_TITLE,
    emoji: DEFAULT_GOAL_EMOJI,
    is_default: true,
  };

  const { data: created, error: insertError } = await client
    .from('user_goals')
    .insert(initial)
    .select(GOAL_COLUMNS)
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error('Failed to create default user goal');
  }

  return created as UserGoalRecord;
}

/**
 * Upserts today's commit row for a user, adding the source's weight to
 * commit_count and incrementing its per-source breakdown count. Repeated
 * activity of the same source on the same day (e.g. uploading 3 artworks)
 * keeps accumulating commits, mirroring GitHub's "more commits = darker
 * square" behavior.
 */
async function recordCommit(
  client: SupabaseClient,
  input: { userId: string; source: CommitSource; eventDate?: Date; note?: string },
): Promise<void> {
  const today = toDateKey(input.eventDate ?? new Date());
  const weight = COMMIT_WEIGHTS[input.source];

  const { data: existing, error: fetchError } = await client
    .from('user_daily_commits')
    .select('commit_count, breakdown, note')
    .eq('user_id', input.userId)
    .eq('commit_date', today)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const breakdown = { ...((existing?.breakdown as Record<string, number>) ?? {}) };
  breakdown[input.source] = (breakdown[input.source] ?? 0) + 1;

  const payload: Record<string, unknown> = {
    user_id: input.userId,
    commit_date: today,
    commit_count: (existing?.commit_count ?? 0) + weight,
    breakdown,
  };

  if (input.note !== undefined) {
    payload.note = input.note;
  } else if (existing?.note) {
    payload.note = existing.note;
  }

  const { error } = await client
    .from('user_daily_commits')
    .upsert(payload, { onConflict: 'user_id,commit_date' });

  if (error) {
    throw error;
  }
}

/** Updates only the note on today's commit row, without touching commit_count/breakdown. */
async function upsertCommitNote(
  client: SupabaseClient,
  input: { userId: string; note: string; eventDate?: Date },
): Promise<void> {
  const today = toDateKey(input.eventDate ?? new Date());

  const { error } = await client
    .from('user_daily_commits')
    .upsert(
      { user_id: input.userId, commit_date: today, note: input.note },
      { onConflict: 'user_id,commit_date', ignoreDuplicates: false },
    );

  if (error) {
    throw error;
  }
}

/**
 * Records automatic activity (daily page visit, artwork upload/COA,
 * favorite) against the user's default "overall activity" goal and the
 * contribution graph. This is the successor to the old single-streak
 * `user_streaks` tracker.
 */
export async function trackUserStreakActivity(
  client: SupabaseClient,
  input: TrackStreakInput,
): Promise<UserGoalRecord> {
  console.log('[Streak] trackUserStreakActivity started', {
    userId: input.userId,
    activityType: input.activityType,
  });
  logger.info('streak_track_started', {
    userId: input.userId,
    activityType: input.activityType,
  });

  try {
    const eventDate = input.eventDate ?? new Date();
    console.log('[Streak] Fetching default goal');
    const current = await getOrCreateDefaultGoal(client, input.userId);
    const nextState = calculateNextDefaultGoalState(current, input.activityType, eventDate);

    console.log('[Streak] Persisting default goal update');
    const { data, error } = await client
      .from('user_goals')
      .update(nextState)
      .eq('id', current.id)
      .select(GOAL_COLUMNS)
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to persist default goal state');
    }

    console.log('[Streak] Recording commit for activity');
    await recordCommit(client, {
      userId: input.userId,
      source: input.activityType,
      eventDate,
    });

    console.log('[Streak] User streak updated successfully');
    logger.info('streak_track_succeeded', {
      userId: input.userId,
      activityType: input.activityType,
      currentStreakDays: data.current_streak_days,
      starTier: data.star_tier,
      dailyUploadCount: data.daily_upload_count,
    });

    return data as UserGoalRecord;
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

/**
 * Explicit "did you work on your art today?" check-in against the
 * default goal, with an optional note. Idempotent per day: re-checking
 * in the same day just updates the note without double-counting commits.
 */
export async function recordManualCheckin(
  client: SupabaseClient,
  input: { userId: string; note?: string; eventDate?: Date },
): Promise<UserGoalRecord> {
  console.log('[Goals] recordManualCheckin started', { userId: input.userId });
  try {
    const eventDate = input.eventDate ?? new Date();
    const today = toDateKey(eventDate);
    const current = await getOrCreateDefaultGoal(client, input.userId);
    const alreadyCheckedInToday = current.last_checkin_date === today;

    if (alreadyCheckedInToday) {
      if (input.note !== undefined) {
        await upsertCommitNote(client, { userId: input.userId, note: input.note, eventDate });
      }
      console.log('[Goals] recordManualCheckin already checked in today, skipping streak update');
      return current;
    }

    const dayState = calculateNextGoalStreakState(current, eventDate);
    const { data, error } = await client
      .from('user_goals')
      .update(dayState)
      .eq('id', current.id)
      .select(GOAL_COLUMNS)
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to persist manual check-in');
    }

    await recordCommit(client, {
      userId: input.userId,
      source: 'manual_checkin',
      eventDate,
      note: input.note,
    });

    console.log('[Goals] recordManualCheckin succeeded', { currentStreakDays: data.current_streak_days });
    return data as UserGoalRecord;
  } catch (error) {
    console.error('[Goals] recordManualCheckin failed', error);
    logger.error('manual_checkin_failed', { userId: input.userId, error });
    throw error;
  }
}

export async function listUserGoals(
  client: SupabaseClient,
  userId: string,
): Promise<UserGoalRecord[]> {
  const { data, error } = await client
    .from('user_goals')
    .select(GOAL_COLUMNS)
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Goals] listUserGoals failed', error);
    throw error;
  }

  return (data ?? []) as UserGoalRecord[];
}

export async function createGoal(
  client: SupabaseClient,
  input: { userId: string; title: string; emoji?: string },
): Promise<UserGoalRecord> {
  const title = input.title.trim().slice(0, 80);

  if (!title) {
    throw new Error('Goal title is required');
  }

  console.log('[Goals] createGoal started', { userId: input.userId, title });

  const { data, error } = await client
    .from('user_goals')
    .insert({
      user_id: input.userId,
      title,
      emoji: input.emoji?.trim() || '⭐',
      is_default: false,
    })
    .select(GOAL_COLUMNS)
    .single();

  if (error || !data) {
    console.error('[Goals] createGoal failed', error);
    throw error ?? new Error('Failed to create goal');
  }

  console.log('[Goals] createGoal succeeded', { goalId: data.id });
  return data as UserGoalRecord;
}

export async function archiveGoal(
  client: SupabaseClient,
  input: { userId: string; goalId: string },
): Promise<void> {
  console.log('[Goals] archiveGoal started', { userId: input.userId, goalId: input.goalId });

  const { error } = await client
    .from('user_goals')
    .update({ is_archived: true })
    .eq('id', input.goalId)
    .eq('user_id', input.userId)
    .eq('is_default', false);

  if (error) {
    console.error('[Goals] archiveGoal failed', error);
    throw error;
  }

  console.log('[Goals] archiveGoal succeeded');
}

/**
 * Check in on a user-created custom goal for today. Idempotent per day.
 */
export async function checkInGoal(
  client: SupabaseClient,
  input: { userId: string; goalId: string; eventDate?: Date },
): Promise<UserGoalRecord> {
  console.log('[Goals] checkInGoal started', { userId: input.userId, goalId: input.goalId });

  try {
    const eventDate = input.eventDate ?? new Date();
    const { data: current, error: fetchError } = await client
      .from('user_goals')
      .select(GOAL_COLUMNS)
      .eq('id', input.goalId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!current) {
      throw new Error('Goal not found');
    }

    const goal = current as UserGoalRecord;
    const today = toDateKey(eventDate);

    if (goal.last_checkin_date === today) {
      console.log('[Goals] checkInGoal already checked in today, skipping');
      return goal;
    }

    const dayState = calculateNextGoalStreakState(goal, eventDate);
    const { data, error } = await client
      .from('user_goals')
      .update(dayState)
      .eq('id', goal.id)
      .select(GOAL_COLUMNS)
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to persist goal check-in');
    }

    await recordCommit(client, {
      userId: input.userId,
      source: 'goal_checkin',
      eventDate,
    });

    console.log('[Goals] checkInGoal succeeded', { currentStreakDays: data.current_streak_days });
    return data as UserGoalRecord;
  } catch (error) {
    console.error('[Goals] checkInGoal failed', error);
    logger.error('goal_checkin_failed', { userId: input.userId, goalId: input.goalId, error });
    throw error;
  }
}

export type DailyCommit = {
  date: string;
  count: number;
  breakdown: Record<string, number>;
  note: string | null;
};

export async function getCommitHistory(
  client: SupabaseClient,
  input: { userId: string; days?: number },
): Promise<DailyCommit[]> {
  const days = input.days ?? 365;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceKey = toDateKey(since);

  const { data, error } = await client
    .from('user_daily_commits')
    .select('commit_date, commit_count, breakdown, note')
    .eq('user_id', input.userId)
    .gte('commit_date', sinceKey)
    .order('commit_date', { ascending: true });

  if (error) {
    console.error('[Goals] getCommitHistory failed', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    date: row.commit_date as string,
    count: row.commit_count as number,
    breakdown: (row.breakdown as Record<string, number>) ?? {},
    note: (row.note as string | null) ?? null,
  }));
}
