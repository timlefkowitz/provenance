'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { MAX_ARTWORK_LINKS, readCollectionLinks, type CollectionLink } from '~/lib/collection-links';

/** Each work's own links (artworks.links), by artwork id; works without links are left out. */
export async function getArtworkLinks(artworkIds: string[]): Promise<Record<string, CollectionLink[]>> {
  const ids = [...new Set(artworkIds)].slice(0, 500);
  if (ids.length === 0) return {};
  const client = asUntyped(getSupabaseServerClient());
  const { data, error } = await client.from('artworks').select('id, links').in('id', ids);
  if (error) {
    // Column missing until the migration is applied; labels just print without them.
    console.error('[ArtworkLinks] Load failed', error);
    return {};
  }
  const out: Record<string, CollectionLink[]> = {};
  for (const row of (data ?? []) as Array<{ id: string; links: unknown }>) {
    const links = readCollectionLinks(row.links, MAX_ARTWORK_LINKS);
    if (links.length) out[row.id] = links;
  }
  return out;
}

/** Replaces one work's links. Owner or gallery team only. */
export async function saveArtworkLinks(
  artworkId: string,
  links: CollectionLink[],
): Promise<{ success: true; links: CollectionLink[] } | { success: false; error: string }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { success: false, error: 'Sign in to save links.' };

    const { data: artwork, error: fetchError } = await client
      .from('artworks')
      .select('id, account_id, gallery_profile_id')
      .eq('id', artworkId)
      .single();
    if (fetchError || !artwork) return { success: false, error: 'Artwork not found.' };

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canEdit) return { success: false, error: 'You cannot edit this artwork.' };

    const cleaned = readCollectionLinks(links, MAX_ARTWORK_LINKS);
    const { error } = await client.from('artworks').update({ links: cleaned }).eq('id', artworkId);
    if (error) {
      console.error('[ArtworkLinks] Save failed', { artworkId, error });
      return { success: false, error: 'Could not save links.' };
    }
    console.log('[ArtworkLinks] Saved', { artworkId, count: cleaned.length });
    revalidatePath('/artworks/my');
    return { success: true, links: cleaned };
  } catch (err) {
    console.error('[ArtworkLinks] Save threw', err);
    return { success: false, error: 'Could not save links.' };
  }
}
