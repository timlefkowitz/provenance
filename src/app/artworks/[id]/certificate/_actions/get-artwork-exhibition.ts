'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

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
  } | null;
} | null;

/**
 * Get the exhibition that an artwork is linked to, including gallery information
 */
export async function getArtworkExhibition(artworkId: string): Promise<ArtworkExhibition> {
  const client = getSupabaseServerClient();

  // Get exhibition from junction table, including gallery_id
  const { data: exhibitionArtwork, error } = await (client as any)
    .from('exhibition_artworks')
    .select(`
      exhibition_id,
      exhibitions!exhibition_artworks_exhibition_id_fkey (
        id,
        title,
        start_date,
        end_date,
        location,
        gallery_id
      )
    `)
    .eq('artwork_id', artworkId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching artwork exhibition:', error);
    return null;
  }

  if (!exhibitionArtwork || !exhibitionArtwork.exhibitions) {
    return null;
  }

  const exhibition = exhibitionArtwork.exhibitions;
  let galleryInfo: { id: string; name: string; profileId?: string } | null = null;

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
        // Check if it's a gallery role
        const galleryRole = getUserRole(galleryAccount.public_data as Record<string, any>);
        
        if (galleryRole === USER_ROLES.GALLERY) {
          // Try to get gallery profile name (preferred)
          const galleryProfile = await getUserProfileByRole(galleryAccount.id, USER_ROLES.GALLERY);
          
          galleryInfo = {
            id: galleryAccount.id,
            name: galleryProfile?.name || galleryAccount.name,
            profileId: galleryProfile?.id,
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

