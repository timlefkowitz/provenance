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

  const seen = new Set<string>();
  const deduped: UserExhibition[] = [];

  if (galleryAccountIds.size > 0) {
    const { data, error } = await (client as any)
      .from('exhibitions')
      .select('id, title, start_date, end_date')
      .in('gallery_id', [...galleryAccountIds])
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[getUserExhibitions] Error fetching gallery exhibitions:', error);
    }

    for (const row of data || []) {
      if (row?.id && !seen.has(row.id)) {
        seen.add(row.id);
        deduped.push(row);
      }
    }
  }

  // Also include exhibitions linked to any of the user's own artworks via exhibition_artworks
  const { data: userArtworks } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('account_id', userId);

  const artworkIds = (userArtworks || []).map((a: { id: string }) => a.id);

  if (artworkIds.length > 0) {
    const { data: links } = await (client as any)
      .from('exhibition_artworks')
      .select('exhibition_id')
      .in('artwork_id', artworkIds);

    const linkedExhibitionIds = [
      ...new Set(
        (links || [])
          .map((l: { exhibition_id: string }) => l.exhibition_id)
          .filter(Boolean),
      ),
    ].filter((id) => !seen.has(id as string)) as string[];

    if (linkedExhibitionIds.length > 0) {
      const { data: linkedExhibitions, error: linkedError } = await (client as any)
        .from('exhibitions')
        .select('id, title, start_date, end_date')
        .in('id', linkedExhibitionIds)
        .order('start_date', { ascending: false });

      if (linkedError) {
        console.error('[getUserExhibitions] Error fetching artwork-linked exhibitions:', linkedError);
      }

      for (const row of linkedExhibitions || []) {
        if (row?.id && !seen.has(row.id)) {
          seen.add(row.id);
          deduped.push(row);
        }
      }
    }
  }

  return deduped;
}

