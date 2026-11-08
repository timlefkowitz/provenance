import type { SupabaseClient } from '@supabase/supabase-js';

import { asUntyped } from '~/lib/supabase-untyped';
import { resolveRequestReviewer } from './cos-approval';

export type ArtworkForReview = {
  id: string;
  account_id: string | null;
  certificate_type: string | null;
  artist_account_id: string | null;
  gallery_profile_id: string | null;
};

export const ARTWORK_FOR_REVIEW_COLUMNS =
  'id, account_id, certificate_type, artist_account_id, gallery_profile_id';

/**
 * Whether `userId` can edit the certificate directly (holder or a team member
 * of the profile it was issued under). Uses the service role so it can be
 * checked for someone other than the signed-in user.
 */
export async function userCanEditCertificate(
  adminClient: SupabaseClient,
  artwork: ArtworkForReview,
  userId: string,
): Promise<boolean> {
  if (artwork.account_id === userId) return true;
  if (!artwork.gallery_profile_id) return false;
  const { data } = await asUntyped(adminClient)
    .from('gallery_members')
    .select('id')
    .eq('gallery_profile_id', artwork.gallery_profile_id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** The account that approves or declines `requestedBy`'s change to this certificate. */
export async function loadRequestReviewer(
  adminClient: SupabaseClient,
  artwork: ArtworkForReview,
  requestedBy: string,
): Promise<string | null> {
  return resolveRequestReviewer({
    artwork,
    requestedBy,
    requesterCanEditCertificate: await userCanEditCertificate(adminClient, artwork, requestedBy),
  });
}
