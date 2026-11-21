'use server';

import { headers } from 'next/headers';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isScanVisitorId } from '~/lib/scan-stats';
import { asUntyped } from '~/lib/supabase-untyped';
import { allowViewRecord } from '~/lib/view-guard';

/**
 * Counts one view of a certificate page (COA, COO or COS). Anyone can call
 * it, so repeat views and bots are filtered by allowViewRecord. Only verified
 * certificates are counted for visitors; the holder's own views are stored
 * with by_owner and left out of the counts.
 */
export async function recordCertificateView(artworkId: string, rawVisitorId?: string | null) {
  if (typeof artworkId !== 'string' || !/^[0-9a-f-]{36}$/i.test(artworkId)) {
    return { recorded: false };
  }
  const visitor = isScanVisitorId(rawVisitorId) ? rawVisitorId : null;

  const requestHeaders = await headers();
  if (!(await allowViewRecord(requestHeaders, `artwork-${artworkId}`, visitor))) {
    return { recorded: false };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: artwork } = await admin
    .from('artworks')
    .select('id, account_id, artist_account_id, status')
    .eq('id', artworkId)
    .maybeSingle();
  if (!artwork) return { recorded: false };

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  const byOwner =
    !!user && (artwork.account_id === user.id || artwork.artist_account_id === user.id);

  // Unverified certificates can only be opened by their holder; nothing to count.
  if (artwork.status !== 'verified' && !byOwner) return { recorded: false };

  const { error } = await admin.from('certificate_views').insert({
    artwork_id: artworkId,
    visitor,
    by_owner: byOwner,
  });
  if (error) {
    console.error('[CertificateView] insert failed', { artworkId, error });
    return { recorded: false };
  }
  return { recorded: true };
}
