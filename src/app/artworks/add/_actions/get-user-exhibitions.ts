'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- exhibitions tables not fully typed on Supabase client */

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type UserExhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export type GetUserExhibitionsOptions = {
  /**
   * When true (Collection Management / mass provenance edit), only list:
   * - exhibitions linked to the user's own artworks, and
   * - exhibitions owned by this account (`gallery_id` = user's account id — all roles).
   * Does not attach every exhibition for galleries where the user is only a team member,
   * so personal collections are not flooded with unrelated shows or open-call listings.
   */
  forCollectionManagement?: boolean;
  /**
   * When set, only return exhibitions that were created under the given mode.
   * Scopes pickers so a gallery account in gallery mode does not see the
   * institution-mode exhibitions it also owns (and vice versa).
   *
   * When `forCollectionManagement` is true, artist-/collector-owner_role exhibitions are
   * always included too so draft shows remain linkable while working in gallery/institution mode.
   */
  ownerRole?: 'gallery' | 'institution';
};

/**
 * Applies owner_role narrowing for exhibition pickers (Supabase chain).
 */
function applyPickerOwnerRoleFilter(query: any, forCollectionManagement: boolean, ownerRole: GetUserExhibitionsOptions['ownerRole']) {
  if (!ownerRole) {
    return query;
  }

  if (forCollectionManagement) {
    return query.or(
      `owner_role.eq.${ownerRole},owner_role.eq.artist,owner_role.eq.collector`,
    );
  }

  return query.eq('owner_role', ownerRole);
}

export async function getUserExhibitions(
  userId: string,
  options?: GetUserExhibitionsOptions,
): Promise<UserExhibition[]> {
  const client = getSupabaseServerClient();
  const forCollectionManagement = options?.forCollectionManagement === true;
  const ownerRole = options?.ownerRole ?? null;
  console.log('[getUserExhibitions] started', {
    forCollectionManagement,
    ownerRole,
    collectionIncludesArtistCollectorDrafts:
      forCollectionManagement && !!ownerRole,
  });

  const galleryAccountIds = new Set<string>();

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .single();

  if (account) {
    // `exhibitions.gallery_id` is always the creating account id (any role — see createExhibition).
    galleryAccountIds.add(userId);
  }

  // Gallery team members: exhibitions belong to the gallery account (for Add Artwork / API only).
  // Skip when editing personal collection so unrelated gallery shows do not appear.
  if (!forCollectionManagement) {
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
  }

  // Exhibitions created for open calls / programs share the exhibitions table; hide them from
  // pickers unless already linked to the user's artwork (linked path below still adds them).
  let openCallExhibitionIds = new Set<string>();
  const { data: openCallRows, error: openCallErr } = await (client as any)
    .from('open_calls')
    .select('exhibition_id');

  if (openCallErr) {
    console.error('[getUserExhibitions] Error fetching open_calls exhibition ids:', openCallErr);
  } else {
    openCallExhibitionIds = new Set(
      (openCallRows || [])
        .map((r: { exhibition_id: string }) => r.exhibition_id)
        .filter(Boolean),
    );
  }

  const seen = new Set<string>();
  const deduped: UserExhibition[] = [];

  if (galleryAccountIds.size > 0) {
    let ownedQuery = (client as any)
      .from('exhibitions')
      .select('id, title, start_date, end_date, owner_role')
      .in('gallery_id', [...galleryAccountIds])
      .order('start_date', { ascending: false });

    if (ownerRole) {
      ownedQuery = applyPickerOwnerRoleFilter(ownedQuery, forCollectionManagement, ownerRole);
    }

    const { data, error } = await ownedQuery;

    if (error) {
      console.error('[getUserExhibitions] Error fetching gallery exhibitions:', error);
    }

    for (const row of data || []) {
      if (row?.id && !seen.has(row.id) && !openCallExhibitionIds.has(row.id)) {
        seen.add(row.id);
        deduped.push({
          id: row.id,
          title: row.title,
          start_date: row.start_date,
          end_date: row.end_date,
        });
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
      let linkedQuery = (client as any)
        .from('exhibitions')
        .select('id, title, start_date, end_date, owner_role')
        .in('id', linkedExhibitionIds)
        .order('start_date', { ascending: false });

      if (ownerRole) {
        linkedQuery = applyPickerOwnerRoleFilter(linkedQuery, forCollectionManagement, ownerRole);
      }

      const { data: linkedExhibitions, error: linkedError } = await linkedQuery;

      if (linkedError) {
        console.error('[getUserExhibitions] Error fetching artwork-linked exhibitions:', linkedError);
      }

      for (const row of linkedExhibitions || []) {
        if (row?.id && !seen.has(row.id)) {
          seen.add(row.id);
          deduped.push({
            id: row.id,
            title: row.title,
            start_date: row.start_date,
            end_date: row.end_date,
          });
        }
      }
    }
  }

  return deduped;
}

