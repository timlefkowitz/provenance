'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const ARTIST_CVS_BUCKET = 'artist-cvs';
/** 10 minutes — long enough to click Download, short enough to prevent sharing. */
const SIGNED_URL_TTL_SECONDS = 600;

export type GetOriginalCvSignedUrlResult =
  | { success: true; url: string; error?: never }
  | { success: false; error: string; url?: never };

/**
 * Mint a short-lived signed URL for the owner to download their original CV file.
 * Verifies the caller is the owner of the profile before issuing the URL.
 */
export async function getOriginalCvSignedUrl(
  profileId: string,
): Promise<GetOriginalCvSignedUrlResult> {
  console.log('[ArtistCV] getOriginalCvSignedUrl started', { profileId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[ArtistCV] getOriginalCvSignedUrl auth failed', authError);
    return { success: false, error: 'You must be signed in to download your CV' };
  }

  // Fetch the profile row — must belong to the authenticated user
  const { data: profileRow, error: profileErr } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, artist_cv_file_path')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('[ArtistCV] getOriginalCvSignedUrl profile fetch failed', profileErr);
    return { success: false, error: 'Could not load profile' };
  }

  if (!profileRow) {
    console.warn('[ArtistCV] getOriginalCvSignedUrl profile not found or not owned', {
      profileId,
      userId: user.id,
    });
    return { success: false, error: 'Profile not found or access denied' };
  }

  const filePath: string | null = profileRow.artist_cv_file_path ?? null;
  if (!filePath) {
    return { success: false, error: 'No CV file uploaded yet' };
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const { data, error: signErr } = await admin.storage
      .from(ARTIST_CVS_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

    if (signErr || !data?.signedUrl) {
      console.error('[ArtistCV] getOriginalCvSignedUrl createSignedUrl failed', signErr);
      return { success: false, error: signErr?.message ?? 'Could not generate download link' };
    }

    console.log('[ArtistCV] getOriginalCvSignedUrl success', { profileId });
    return { success: true, url: data.signedUrl };
  } catch (err) {
    console.error('[ArtistCV] getOriginalCvSignedUrl unexpected error', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate download link',
    };
  }
}
