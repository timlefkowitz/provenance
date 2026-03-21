'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- user_profiles not in generated Supabase Database type */
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES, type UserRole } from '~/lib/user-roles';

export type EnsureArtistProfileResult = {
  artistAccountId: string | null;
  artistProfileId: string | null;
};

/**
 * Resolve or create an artist user_profiles row for certificate flows (gallery / collector posts).
 * Sets artist_account_id when a registered artist account matches by name; always ties artist_profile_id when possible.
 */
export async function ensureArtistProfileForCertificate(params: {
  artistName: string;
  posterAccountId: string;
  medium?: string | null;
  posterRole: UserRole;
}): Promise<EnsureArtistProfileResult> {
  const { artistName, posterAccountId, medium, posterRole } = params;
  const trimmed = artistName?.trim() || '';
  if (!trimmed) {
    return { artistAccountId: null, artistProfileId: null };
  }

  if (posterRole !== USER_ROLES.GALLERY && posterRole !== USER_ROLES.COLLECTOR) {
    return { artistAccountId: null, artistProfileId: null };
  }

  console.log('[Certificates] ensureArtistProfileForCertificate started', {
    posterAccountId,
    posterRole,
    hasMedium: Boolean(medium?.trim()),
  });

  try {
    const client = getSupabaseServerClient();

    let artistAccountId: string | null = null;

    const { data: nameMatchAccounts } = await client
      .from('accounts')
      .select('id, public_data')
      .eq('name', trimmed)
      .limit(3);

    for (const row of nameMatchAccounts || []) {
      const role = getUserRole(row.public_data as Record<string, unknown>);
      if (role === USER_ROLES.ARTIST) {
        artistAccountId = row.id;
        break;
      }
    }

    if (artistAccountId) {
      const { data: claimedProfile } = await (client as any)
        .from('user_profiles')
        .select('id')
        .eq('user_id', artistAccountId)
        .eq('role', 'artist')
        .eq('is_active', true)
        .maybeSingle();

      if (claimedProfile?.id) {
        console.log('[Certificates] ensureArtistProfileForCertificate matched registered artist', {
          artistAccountId,
          artistProfileId: claimedProfile.id,
        });
        return { artistAccountId, artistProfileId: claimedProfile.id as string };
      }

      console.log('[Certificates] ensureArtistProfileForCertificate artist account without profile row', {
        artistAccountId,
      });
      return { artistAccountId, artistProfileId: null };
    }

    const { data: existingByName } = await (client as any)
      .from('user_profiles')
      .select('id, user_id, is_claimed')
      .eq('name', trimmed)
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('is_claimed', { ascending: false })
      .limit(5);

    const preferred =
      (existingByName || []).find((p: { user_id: string | null }) => p.user_id) ||
      (existingByName || [])[0];

    if (preferred?.id) {
      const uid = preferred.user_id as string | null;
      console.log('[Certificates] ensureArtistProfileForCertificate reused profile by name', {
        artistProfileId: preferred.id,
        hasUserId: Boolean(uid),
      });
      return {
        artistAccountId: uid,
        artistProfileId: preferred.id as string,
      };
    }

    const { data: inserted, error: insertError } = await (client as any)
      .from('user_profiles')
      .insert({
        user_id: null,
        role: 'artist',
        name: trimmed,
        medium: medium?.trim() || null,
        is_claimed: false,
        created_by_gallery_id: posterAccountId,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: again } = await (client as any)
          .from('user_profiles')
          .select('id, user_id')
          .eq('name', trimmed)
          .eq('role', 'artist')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (again?.id) {
          return {
            artistAccountId: (again.user_id as string) || null,
            artistProfileId: again.id as string,
          };
        }
      }
      console.error('[Certificates] ensureArtistProfileForCertificate insert failed', insertError);
      return { artistAccountId: null, artistProfileId: null };
    }

    console.log('[Certificates] ensureArtistProfileForCertificate created unclaimed profile', {
      artistProfileId: inserted?.id,
    });
    return { artistAccountId: null, artistProfileId: (inserted?.id as string) || null };
  } catch (err) {
    console.error('[Certificates] ensureArtistProfileForCertificate failed', err);
    return { artistAccountId: null, artistProfileId: null };
  }
}
