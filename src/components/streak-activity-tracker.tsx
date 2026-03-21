'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';
import { useCurrentUser } from '~/hooks/use-current-user';

const LAST_STREAK_PING_KEY = 'streak_last_activity_ping_date';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StreakActivityTracker() {
  const user = useCurrentUser();

  useEffect(() => {
    if (!user.data?.id) {
      return;
    }

    const today = getTodayKey();
    const lastPing = localStorage.getItem(LAST_STREAK_PING_KEY);

    if (lastPing === today) {
      return;
    }

    console.log('[Streak] Sending daily activity ping');
    void fetch('/api/streak/activity', { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`streak activity ping failed (${response.status})`);
        }

        const data = (await response.json()) as {
          streakDays?: number;
          starTier?: string;
        };

        localStorage.setItem(LAST_STREAK_PING_KEY, today);
        track('streak_daily_activity', {
          streakDays: data.streakDays ?? 0,
          starTier: data.starTier ?? 'bronze',
        });
        console.log('[Streak] Daily activity ping succeeded');
      })
      .catch((error) => {
        console.error('[Streak] Daily activity ping failed', error);
      });
  }, [user.data?.id]);

  return null;
}
