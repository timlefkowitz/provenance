'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export type UserExhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export async function getUserExhibitions(userId: string): Promise<UserExhibition[]> {
  const client = getSupabaseServerClient();

  const galleryAccountIds = new Set<string>();

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .single();

  if (account) {
    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole === USER_ROLES.GALLERY) {
      galleryAccountIds.add(userId);
    }
  }

  // Gallery team members: exhibitions belong to the gallery account, not the member's personal account
  const { data: memberships } = await (client as any)
    .from('gallery_members')
    .select('gallery_profile_id')
    .eq('user_id', userId);

  if (memberships?.length) {
    const profileIds = memberships.map((m: { gallery_profile_id: string }) => m.gallery_profile_id);
    const { data: profiles } = await (client as any)
      .from('user_profiles')
      .select('user_id')
      .in('id', profileIds)
      .eq('role', 'gallery');

    profiles?.forEach((p: { user_id: string | null }) => {
      if (p.user_id) {
        galleryAccountIds.add(p.user_id);
      }
    });
  }

  if (galleryAccountIds.size === 0) {
    return [];
  }

  const { data, error } = await (client as any)
    .from('exhibitions')
    .select('id, title, start_date, end_date')
    .in('gallery_id', [...galleryAccountIds])
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[getUserExhibitions] Error fetching exhibitions:', error);
    return [];
  }

  const seen = new Set<string>();
  const deduped: UserExhibition[] = [];
  for (const row of data || []) {
    if (row?.id && !seen.has(row.id)) {
      seen.add(row.id);
      deduped.push(row);
    }
  }

  return deduped;
}

