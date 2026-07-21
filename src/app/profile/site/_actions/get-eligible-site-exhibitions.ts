'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { getEligibleSiteExhibitions } from '~/app/_sites/_data/get-eligible-site-exhibitions';

export type EligibleSiteExhibition = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
};

/**
 * Fetch exhibitions the authenticated user is allowed to feature on their site.
 * Only gallery profiles have exhibitions; only the profile owner or a gallery
 * team admin/owner may call this.
 */
export async function getEligibleSiteExhibitionsAction(
  profileId: string,
): Promise<EligibleSiteExhibition[]> {
  console.log('[Sites] getEligibleSiteExhibitionsAction', { profileId });
  const client = getSupabaseServerClient();

  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return [];

  const { data: profile } = await asUntyped(client)
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile) return [];

  // Only gallery profiles have exhibitions
  if (profile.role !== 'gallery') return [];

  const isOwner = profile.user_id === user.id;
  const isTeamMember = !isOwner
    ? await canManageGallery(user.id, profileId)
    : false;

  if (!isOwner && !isTeamMember) return [];

  const rows = await getEligibleSiteExhibitions(client as any, profile, 96);

  console.log('[Sites] getEligibleSiteExhibitionsAction resolved', {
    profileId,
    count: rows.length,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    start_date: r.start_date,
    end_date: r.end_date ?? null,
    location: r.location ?? null,
    image_url: r.image_url ?? null,
  }));
}
