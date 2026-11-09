'use server';

import { headers } from 'next/headers';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { allowScanRecord } from '~/lib/scan-guard';
import { isScanVisitorId } from '~/lib/scan-stats';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Records a scan of a show's own QR code (poster, flyer, catalog, checklist),
 * which opens the exhibition page with ?scan=poster. Anyone can call it, so
 * it's rate limited per IP like certificate scans. Only published shows are
 * counted, and no location or device details are kept.
 */
export async function recordPosterScan(exhibitionId: string, rawVisitorId?: string | null) {
  if (typeof exhibitionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exhibitionId)) {
    return { recorded: false };
  }

  const requestHeaders = await headers();
  if (!(await allowScanRecord(requestHeaders, `exhibition-${exhibitionId}`))) {
    console.log('[PosterScan] repeat scan throttled', { exhibitionId });
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

  // Drafts can only be opened by the team; nothing to count.
  if (!exhibition.published_at && !byTeam) return { recorded: false };

  const { error } = await admin.from('exhibition_poster_scans').insert({
    exhibition_id: exhibitionId,
    visitor: isScanVisitorId(rawVisitorId) ? rawVisitorId : null,
    by_team: byTeam,
  });
  if (error) {
    console.error('[PosterScan] insert failed', { exhibitionId, error });
    return { recorded: false };
  }

  console.log('[PosterScan] recorded', { exhibitionId, byTeam });
  return { recorded: true };
}
