'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { type UserRole } from '~/lib/user-roles';
import { postsOthersWork, resolveArtist } from '~/lib/people/resolve-artist';
import type { PersonValue } from '~/lib/people/types';

export type EnsureArtistProfileResult = {
  artistAccountId: string | null;
  artistProfileId: string | null;
};

/**
 * Resolve the artist of a work posted by a gallery, collector or institution
 * to an account and/or artist profile, creating a placeholder profile when the
 * artist isn't on Provenance. Pass `artist` (from a PersonPicker) when the user
 * picked someone; `artistName` alone is matched by name. See resolveArtist.
 */
export async function ensureArtistProfileForCertificate(params: {
  artistName: string;
  artist?: PersonValue | null;
  posterAccountId: string;
  medium?: string | null;
  posterRole: UserRole;
}): Promise<EnsureArtistProfileResult> {
  const { artistName, artist, posterAccountId, medium, posterRole } = params;
  if (!postsOthersWork(posterRole)) {
    return { artistAccountId: null, artistProfileId: null };
  }
  const value: PersonValue | null = artist ?? (artistName?.trim() ? { name: artistName } : null);
  if (!value) {
    return { artistAccountId: null, artistProfileId: null };
  }

  try {
    const resolved = await resolveArtist(getSupabaseServerAdminClient(), {
      artist: value,
      posterAccountId,
      medium,
    });
    console.log('[Certificates] ensureArtistProfileForCertificate resolved', {
      posterRole,
      linkedAccount: Boolean(resolved.artistAccountId),
      linkedProfile: Boolean(resolved.artistProfileId),
      created: resolved.created,
    });
    return {
      artistAccountId: resolved.artistAccountId,
      artistProfileId: resolved.artistProfileId,
    };
  } catch (err) {
    console.error('[Certificates] ensureArtistProfileForCertificate failed', err);
    return { artistAccountId: null, artistProfileId: null };
  }
}
