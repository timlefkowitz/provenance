'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { getUserRole, isTeamProfileRole } from '~/lib/user-roles';

export type ArtworkExhibition = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  gallery?: {
    id: string;
    name: string;
    profileId?: string;
    slug?: string;
  } | null;
} | null;

/**
 * Get the exhibition that an artwork is linked to, including gallery information
 */
export async function getArtworkExhibition(artworkId: string): Promise<ArtworkExhibition> {
  const client = asUntyped(getSupabaseServerClient());

  // Get exhibition from junction table, including gallery_id
  const { data: exhibitionArtwork, error } = await asUntyped(client)
    .from('exhibition_artworks')
    .select(`
      exhibition_id,
      exhibitions!exhibition_artworks_exhibition_id_fkey (
        id,
        title,
        start_date,
        end_date,
        location,
        gallery_id,
        owner_role
      )
    `)
    .eq('artwork_id', artworkId)
    .eq('status', 'selected')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching artwork exhibition:', error);
    return null;
  }

  if (!exhibitionArtwork || !exhibitionArtwork.exhibitions) {
    return null;
  }

  // A to-one embed is an object at runtime; the inferred type is an array.
  const embedded = exhibitionArtwork.exhibitions;
  const exhibition = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!exhibition) {
    return null;
  }
  let galleryInfo: { id: string; name: string; profileId?: string; slug?: string } | null = null;

  // Fetch gallery information if gallery_id exists
  if (exhibition.gallery_id) {
    try {
      // Get gallery account
      const { data: galleryAccount } = await client
        .from('accounts')
        .select('id, name, public_data')
        .eq('id', exhibition.gallery_id)
        .single();

      if (galleryAccount) {
        // The show's owner mode (gallery / institution) decides which profile to name;
        // fall back to the account's current role for older rows without owner_role.
        const accountRole = getUserRole(galleryAccount.public_data as Record<string, unknown>);
        const ownerRole = isTeamProfileRole(exhibition.owner_role)
          ? exhibition.owner_role
          : isTeamProfileRole(accountRole)
            ? accountRole
            : null;

        if (ownerRole) {
          // Try to get gallery / institution profile name (preferred)
          const galleryProfile = await getUserProfileByRole(galleryAccount.id, ownerRole);
          
          // If getUserProfileByRole doesn't return slug, fetch it directly
          let slug: string | undefined = undefined;
          if (galleryProfile?.id) {
            const { data: profileWithSlug } = await client
              .from('user_profiles')
              .select('slug')
              .eq('id', galleryProfile.id)
              .single();
            slug = profileWithSlug?.slug || undefined;
          }
          
          galleryInfo = {
            id: galleryAccount.id,
            name: galleryProfile?.name || galleryAccount.name,
            profileId: galleryProfile?.id,
            slug: slug,
          };
        } else {
          // Fallback to account name if not a gallery
          galleryInfo = {
            id: galleryAccount.id,
            name: galleryAccount.name,
          };
        }
      }
    } catch (galleryError) {
      console.error('Error fetching gallery information:', galleryError);
      // Continue without gallery info
    }
  }

  return {
    id: exhibition.id,
    title: exhibition.title,
    start_date: exhibition.start_date,
    end_date: exhibition.end_date,
    location: exhibition.location,
    gallery: galleryInfo,
  };
}

