import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { logger } from '~/lib/logger';
import { trackUserStreakActivity } from '~/lib/streak-service';

export async function POST() {
  console.log('[API/streak/activity] started');
  try {
    const client = getSupabaseServerClient();

    console.log('[API/streak/activity] checking authenticated user');
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    console.log('[API/streak/activity] tracking daily activity streak event');
    const streak = await trackUserStreakActivity(client, {
      userId: user.id,
      activityType: 'daily_activity',
    });

    console.log('[API/streak/activity] success');
    return NextResponse.json({
      ok: true,
      streakDays: streak.current_streak_days,
      starTier: streak.star_tier,
    });
  } catch (error) {
    console.error('[API/streak/activity] failed', error);
    logger.error('api_streak_activity_failed', { error });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
