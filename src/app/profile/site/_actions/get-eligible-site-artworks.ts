'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { getEligibleSiteArtworks } from '~/app/_sites/_data/get-eligible-site-artworks';
import { DEFAULT_ARTWORK_FILTERS } from '~/app/_sites/types';

export type EligibleSiteArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
};

/**
 * Fetch artworks the authenticated user is allowed to feature on their site.
 * Only the profile owner or a gallery team admin/owner may call this.
 */
export async function getEligibleSiteArtworksAction(
  profileId: string,
): Promise<EligibleSiteArtwork[]> {
  console.log('[Sites] getEligibleSiteArtworksAction', { profileId });
  const client = getSupabaseServerClient();

  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return [];

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile) return [];

  const isOwner = profile.user_id === user.id;
  const isTeamMember =
    !isOwner && profile.role === 'gallery'
      ? await canManageGallery(user.id, profileId)
      : false;

  if (!isOwner && !isTeamMember) return [];

  const rows = await getEligibleSiteArtworks(
    client as any,
    profile,
    DEFAULT_ARTWORK_FILTERS,
    96,
  );

  console.log('[Sites] getEligibleSiteArtworksAction resolved', {
    profileId,
    count: rows.length,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist_name: r.artist_name ?? null,
    image_url: r.image_url ?? null,
    created_at: r.created_at,
    certificate_number: r.certificate_number,
  }));
}
