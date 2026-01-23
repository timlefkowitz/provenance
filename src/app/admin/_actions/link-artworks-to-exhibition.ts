'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { isAdmin } from '~/lib/admin';
import { revalidatePath } from 'next/cache';

/**
 * Link artworks to an exhibition
 * Admin-only action to fix missing artwork-exhibition links
 */
export async function linkArtworksToExhibition(
  exhibitionTitle: string,
  galleryAccountId?: string,
  artworkIds?: string[]
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to link artworks to exhibitions' };
    }

    const adminClient = getSupabaseServerAdminClient();

    // Find the exhibition by title (case-insensitive)
    const { data: exhibitions, error: exhibitionError } = await adminClient
      .from('exhibitions')
      .select('id, title, gallery_id')
      .ilike('title', `%${exhibitionTitle}%`);

    if (exhibitionError) {
      console.error('Error fetching exhibition:', exhibitionError);
      return { error: `Failed to find exhibition: ${exhibitionError.message}` };
    }

    if (!exhibitions || exhibitions.length === 0) {
      return { error: `No exhibition found with title containing "${exhibitionTitle}"` };
    }

    if (exhibitions.length > 1) {
      return {
        error: `Multiple exhibitions found: ${exhibitions.map(e => e.title).join(', ')}. Please be more specific.`,
        exhibitions: exhibitions.map(e => ({ id: e.id, title: e.title, gallery_id: e.gallery_id })),
      };
    }

    const exhibition = exhibitions[0];
    const exhibitionId = exhibition.id;
    const exhibitionGalleryId = exhibition.gallery_id;

    // If galleryAccountId is provided, use it; otherwise use the exhibition's gallery_id
    const targetGalleryId = galleryAccountId || exhibitionGalleryId;

    // Get artworks to link
    let artworksToLink: Array<{ id: string }> = [];

    if (artworkIds && artworkIds.length > 0) {
      // Use provided artwork IDs
      const { data: artworks, error: artworksError } = await adminClient
        .from('artworks')
        .select('id')
        .in('id', artworkIds);

      if (artworksError) {
        return { error: `Failed to fetch artworks: ${artworksError.message}` };
      }

      artworksToLink = artworks || [];
    } else {
      // Find artworks by gallery account
      // Get all artworks from the gallery account that aren't already linked to this exhibition
      const { data: existingLinks } = await adminClient
        .from('exhibition_artworks')
        .select('artwork_id')
        .eq('exhibition_id', exhibitionId);

      const existingArtworkIds = new Set((existingLinks || []).map((l: any) => l.artwork_id));

      const { data: artworks, error: artworksError } = await adminClient
        .from('artworks')
        .select('id, status')
        .eq('account_id', targetGalleryId)
        .eq('status', 'verified'); // Only link verified artworks

      if (artworksError) {
        return { error: `Failed to fetch artworks: ${artworksError.message}` };
      }

      // Filter out artworks already linked
      artworksToLink = (artworks || []).filter((a: any) => !existingArtworkIds.has(a.id));
    }

    if (artworksToLink.length === 0) {
      return {
        success: true,
        message: 'No artworks to link. All artworks may already be linked, or no verified artworks found.',
        linkedCount: 0,
        exhibition: {
          id: exhibitionId,
          title: exhibition.title,
          gallery_id: exhibitionGalleryId,
        },
      };
    }

    // Link artworks to exhibition
    const linksToInsert = artworksToLink.map((artwork: any) => ({
      exhibition_id: exhibitionId,
      artwork_id: artwork.id,
    }));

    const { error: insertError } = await adminClient
      .from('exhibition_artworks')
      .insert(linksToInsert);

    if (insertError) {
      // Check if it's a duplicate key error (some artworks might already be linked)
      if (insertError.code === '23505') {
        // Try inserting one by one to see which ones succeed
        let successCount = 0;
        let duplicateCount = 0;
        const errors: string[] = [];

        for (const link of linksToInsert) {
          try {
            const { error: singleInsertError } = await adminClient
              .from('exhibition_artworks')
              .insert(link);

            if (singleInsertError) {
              if (singleInsertError.code === '23505') {
                duplicateCount++;
              } else {
                errors.push(`Failed to link artwork ${link.artwork_id}: ${singleInsertError.message}`);
              }
            } else {
              successCount++;
            }
          } catch (err: any) {
            errors.push(`Error linking artwork ${link.artwork_id}: ${err.message}`);
          }
        }

        return {
          success: true,
          message: `Linked ${successCount} artworks. ${duplicateCount} were already linked.`,
          linkedCount: successCount,
          duplicateCount,
          errors: errors.length > 0 ? errors : undefined,
          exhibition: {
            id: exhibitionId,
            title: exhibition.title,
            gallery_id: exhibitionGalleryId,
          },
        };
      }

      return { error: `Failed to link artworks: ${insertError.message}` };
    }

    // Revalidate relevant paths
    revalidatePath(`/exhibitions/${exhibitionId}`);
    revalidatePath('/exhibitions');
    revalidatePath(`/artists/${targetGalleryId}`);

    return {
      success: true,
      message: `Successfully linked ${artworksToLink.length} artwork(s) to "${exhibition.title}"`,
      linkedCount: artworksToLink.length,
      exhibition: {
        id: exhibitionId,
        title: exhibition.title,
        gallery_id: exhibitionGalleryId,
      },
    };
  } catch (error: any) {
    console.error('Error in linkArtworksToExhibition:', error);
    return { error: `An unexpected error occurred: ${error.message || 'Unknown error'}` };
  }
}

/**
 * Find artworks that should be linked to an exhibition
 * Helper function to identify artworks before linking
 */
export async function findArtworksForExhibition(
  exhibitionTitle: string,
  galleryAccountId?: string
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to search artworks' };
    }

    const adminClient = getSupabaseServerAdminClient();

    // Find the exhibition
    const { data: exhibitions, error: exhibitionError } = await adminClient
      .from('exhibitions')
      .select('id, title, gallery_id')
      .ilike('title', `%${exhibitionTitle}%`);

    if (exhibitionError || !exhibitions || exhibitions.length === 0) {
      return { error: `No exhibition found with title containing "${exhibitionTitle}"` };
    }

    if (exhibitions.length > 1) {
      return {
        error: `Multiple exhibitions found: ${exhibitions.map(e => e.title).join(', ')}`,
        exhibitions: exhibitions.map(e => ({ id: e.id, title: e.title, gallery_id: e.gallery_id })),
      };
    }

    const exhibition = exhibitions[0];
    const exhibitionId = exhibition.id;
    const targetGalleryId = galleryAccountId || exhibition.gallery_id;

    // Get existing links
    const { data: existingLinks } = await adminClient
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', exhibitionId);

    const existingArtworkIds = new Set((existingLinks || []).map((l: any) => l.artwork_id));

    // Find artworks from the gallery that aren't linked
    const { data: artworks, error: artworksError } = await adminClient
      .from('artworks')
      .select('id, title, status, created_at')
      .eq('account_id', targetGalleryId)
      .eq('status', 'verified')
      .order('created_at', { ascending: false });

    if (artworksError) {
      return { error: `Failed to fetch artworks: ${artworksError.message}` };
    }

    const unlinkedArtworks = (artworks || []).filter((a: any) => !existingArtworkIds.has(a.id));

    return {
      success: true,
      exhibition: {
        id: exhibitionId,
        title: exhibition.title,
        gallery_id: exhibition.gallery_id,
      },
      totalArtworks: artworks?.length || 0,
      linkedArtworks: existingArtworkIds.size,
      unlinkedArtworks: unlinkedArtworks.length,
      artworks: unlinkedArtworks.map((a: any) => ({
        id: a.id,
        title: a.title,
        created_at: a.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error in findArtworksForExhibition:', error);
    return { error: `An unexpected error occurred: ${error.message || 'Unknown error'}` };
  }
}

