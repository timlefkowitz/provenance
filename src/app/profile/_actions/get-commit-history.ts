'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { logger } from '~/lib/logger';
import { getCommitHistory as getCommitHistoryRecords } from '~/lib/streak-service';

export type CommitDayView = {
  date: string;
  count: number;
  breakdown: Record<string, number>;
  note: string | null;
};

/**
 * Public commit history for the contribution graph. user_daily_commits has
 * a public-read RLS policy, so this works for both the owner's own profile
 * and visitors viewing an artist's public page.
 */
export async function getCommitHistory(userId: string, days = 365): Promise<CommitDayView[]> {
  console.log('[Goals] getCommitHistory started', { userId, days });
  const client = getSupabaseServerClient();

  try {
    const commits = await getCommitHistoryRecords(client, { userId, days });
    console.log('[Goals] getCommitHistory succeeded', { userId, count: commits.length });
    return commits;
  } catch (error) {
    console.error('[Goals] getCommitHistory failed', error);
    logger.error('get_commit_history_failed', { userId, error });
    return [];
  }
}
