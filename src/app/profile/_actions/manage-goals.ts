'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { logger } from '~/lib/logger';
import {
  archiveGoal as archiveGoalRecord,
  createGoal as createGoalRecord,
  listUserGoals,
  type StarTier,
} from '~/lib/streak-service';

export type UserGoalView = {
  id: string;
  title: string;
  emoji: string;
  isDefault: boolean;
  currentStreakDays: number;
  longestStreakDays: number;
  starTier: StarTier;
  checkedInToday: boolean;
};

function toTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getMyGoals(): Promise<UserGoalView[]> {
  console.log('[Goals] getMyGoals started');
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return [];
  }

  try {
    const goals = await listUserGoals(client, user.id);
    const today = toTodayKey();

    console.log('[Goals] getMyGoals succeeded', { userId: user.id, count: goals.length });
    return goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      emoji: goal.emoji,
      isDefault: goal.is_default,
      currentStreakDays: goal.current_streak_days,
      longestStreakDays: goal.longest_streak_days,
      starTier: goal.star_tier,
      checkedInToday: goal.last_checkin_date === today,
    }));
  } catch (error) {
    console.error('[Goals] getMyGoals failed', error);
    logger.error('get_my_goals_failed', { userId: user.id, error });
    return [];
  }
}

export async function createGoal(input: { title: string; emoji?: string }) {
  console.log('[Goals] createGoal action started');
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to create a goal');
  }

  const title = input.title.trim();

  if (!title) {
    throw new Error('Give your goal a name');
  }

  try {
    const existing = await listUserGoals(client, user.id);
    if (existing.length >= 12) {
      throw new Error('You can track up to 12 goals at a time');
    }

    const goal = await createGoalRecord(client, {
      userId: user.id,
      title,
      emoji: input.emoji,
    });

    revalidatePath('/profile');
    revalidatePath('/goals');
    console.log('[Goals] createGoal action succeeded', { goalId: goal.id });
    return { success: true, goalId: goal.id };
  } catch (error) {
    console.error('[Goals] createGoal action failed', error);
    logger.error('create_goal_action_failed', { userId: user.id, error });
    throw error instanceof Error ? error : new Error('Failed to create goal');
  }
}

export async function archiveGoal(goalId: string) {
  console.log('[Goals] archiveGoal action started', { goalId });
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to archive a goal');
  }

  try {
    await archiveGoalRecord(client, { userId: user.id, goalId });
    revalidatePath('/profile');
    revalidatePath('/goals');
    console.log('[Goals] archiveGoal action succeeded');
    return { success: true };
  } catch (error) {
    console.error('[Goals] archiveGoal action failed', error);
    logger.error('archive_goal_action_failed', { userId: user.id, goalId, error });
    throw new Error('Failed to archive goal');
  }
}
