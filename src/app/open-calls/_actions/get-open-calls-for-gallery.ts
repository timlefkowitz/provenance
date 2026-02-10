'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';

export type OpenCallListItem = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  exhibition: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
  };
};

export async function getOpenCallsForGallery(userId: string): Promise<OpenCallListItem[]> {
  const client = getSupabaseServerClient();

  const { data: ownedProfiles } = await client
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', USER_ROLES.GALLERY);

  const { data: memberProfiles } = await client
    .from('gallery_members')
    .select('gallery_profile_id')
    .eq('user_id', userId);

  const profileIds = Array.from(
    new Set([
      ...(ownedProfiles || []).map((profile) => profile.id),
      ...(memberProfiles || []).map((member) => member.gallery_profile_id),
    ]),
  );

  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await (client as any)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, exhibition:exhibition_id (id, title, start_date, end_date, location)',
    )
    .in('gallery_profile_id', profileIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching open calls:', error);
    return [];
  }

  return (data || []) as OpenCallListItem[];
}
