import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export type ExhibitionShareMeta = {
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  /**
   * The gallery's public brand name (e.g. "FL!GHT") when the owner is a
   * gallery, falling back to the owner account name for non-gallery owners.
   */
  ownerName: string | null;
};

/**
 * Resolves the display metadata used for exhibition link previews (Open Graph,
 * Twitter, iMessage). Critically, for gallery-owned exhibitions this returns the
 * gallery brand name from `user_profiles` (e.g. "FL!GHT") rather than the
 * personal account name (e.g. "Timothy Lefkowitz").
 */
export async function getExhibitionShareMeta(
  exhibitionId: string,
): Promise<ExhibitionShareMeta | null> {
  console.log('[Exhibitions] getExhibitionShareMeta started', { exhibitionId });

  const admin = getSupabaseServerAdminClient() as any;

  const { data: exhibition, error } = await admin
    .from('exhibitions')
    .select(
      'title, description, location, start_date, end_date, image_url, gallery_id, owner_role',
    )
    .eq('id', exhibitionId)
    .maybeSingle();

  if (error) {
    console.error('[Exhibitions] getExhibitionShareMeta failed to load exhibition', error);
  }

  if (!exhibition) {
    return null;
  }

  let ownerName: string | null = null;

  if (exhibition.gallery_id) {
    try {
      const { data: account } = await admin
        .from('accounts')
        .select('name, public_data')
        .eq('id', exhibition.gallery_id)
        .maybeSingle();

      ownerName = account?.name ?? null;

      const accountRole = getUserRole(
        (account?.public_data as Record<string, any>) ?? {},
      );
      const isGallery =
        accountRole === USER_ROLES.GALLERY ||
        exhibition.owner_role === USER_ROLES.GALLERY;

      // For galleries, prefer the gallery brand profile (e.g. "FL!GHT") over
      // the personal account name (e.g. "Timothy Lefkowitz").
      if (isGallery) {
        const { data: galleryProfiles } = await admin
          .from('user_profiles')
          .select('name')
          .eq('user_id', exhibition.gallery_id)
          .eq('role', USER_ROLES.GALLERY)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (galleryProfiles && galleryProfiles.length > 0) {
          const accountName = (account?.name ?? '').toLowerCase();
          // Prefer a profile whose name differs from the account name, which is
          // how the gallery brand (FL!GHT) is distinguished from the owner.
          const brandProfile =
            galleryProfiles.find(
              (p: { name?: string | null }) =>
                (p.name ?? '').toLowerCase() !== accountName,
            ) ?? galleryProfiles[0];

          if (brandProfile?.name) {
            ownerName = brandProfile.name;
          }
        }
      }
    } catch (err) {
      console.error('[Exhibitions] getExhibitionShareMeta failed to resolve owner name', err);
    }
  }

  console.log('[Exhibitions] getExhibitionShareMeta resolved', {
    exhibitionId,
    ownerName,
  });

  return {
    title: exhibition.title,
    description: exhibition.description ?? null,
    location: exhibition.location ?? null,
    startDate: exhibition.start_date ?? null,
    endDate: exhibition.end_date ?? null,
    imageUrl: exhibition.image_url ?? null,
    ownerName,
  };
}
