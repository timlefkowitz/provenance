'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { logger } from '~/lib/logger';
import { checkInGoal, recordManualCheckin, type StarTier } from '~/lib/streak-service';

export type CheckinResult = {
  success: boolean;
  currentStreakDays: number;
  longestStreakDays: number;
  starTier: StarTier;
};

/**
 * "Did you work on your art today?" check-in against the default
 * overall-activity goal, with an optional note for the day's commit.
 */
export async function checkInToday(note?: string): Promise<CheckinResult> {
  console.log('[Goals] checkInToday action started');
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to check in');
  }

  try {
    const trimmedNote = note?.trim().slice(0, 280) || undefined;
    const goal = await recordManualCheckin(client, { userId: user.id, note: trimmedNote });

    revalidatePath('/profile');
    console.log('[Goals] checkInToday action succeeded', { currentStreakDays: goal.current_streak_days });
    return {
      success: true,
      currentStreakDays: goal.current_streak_days,
      longestStreakDays: goal.longest_streak_days,
      starTier: goal.star_tier,
    };
  } catch (error) {
    console.error('[Goals] checkInToday action failed', error);
    logger.error('check_in_today_failed', { userId: user.id, error });
    throw new Error('Failed to check in');
  }
}

/**
 * Check in on a specific user-created custom goal for today.
 */
export async function checkInToGoal(goalId: string): Promise<CheckinResult> {
  console.log('[Goals] checkInToGoal action started', { goalId });
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to check in');
  }

  try {
    const goal = await checkInGoal(client, { userId: user.id, goalId });

    revalidatePath('/profile');
    console.log('[Goals] checkInToGoal action succeeded', { currentStreakDays: goal.current_streak_days });
    return {
      success: true,
      currentStreakDays: goal.current_streak_days,
      longestStreakDays: goal.longest_streak_days,
      starTier: goal.star_tier,
    };
  } catch (error) {
    console.error('[Goals] checkInToGoal action failed', error);
    logger.error('check_in_to_goal_failed', { userId: user.id, goalId, error });
    throw new Error('Failed to check in');
  }
}
