'use server';

import { headers } from 'next/headers';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { isScanVisitorId } from '~/lib/scan-stats';
import { asUntyped } from '~/lib/supabase-untyped';
import { allowViewRecord } from '~/lib/view-guard';

/**
 * Counts one view of an exhibition page. Anyone can call it, so repeat views
 * and bots are filtered by allowViewRecord. Only published shows are counted;
 * the team's own views are stored with by_team and left out of the counts.
 */
export async function recordExhibitionView(exhibitionId: string, rawVisitorId?: string | null) {
  if (typeof exhibitionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exhibitionId)) {
    return { recorded: false };
  }
  const visitor = isScanVisitorId(rawVisitorId) ? rawVisitorId : null;

  const requestHeaders = await headers();
  if (!(await allowViewRecord(requestHeaders, `exhibition-${exhibitionId}`, visitor))) {
    return { recorded: false };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return { recorded: false };

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  const byTeam = !!user && (await canManageExhibition(user.id, exhibition.gallery_id as string));

  if (!exhibition.published_at && !byTeam) return { recorded: false };

  const { error } = await admin.from('exhibition_views').insert({
    exhibition_id: exhibitionId,
    visitor,
    by_team: byTeam,
  });
  if (error) {
    console.error('[ExhibitionView] insert failed', { exhibitionId, error });
    return { recorded: false };
  }
  return { recorded: true };
}
