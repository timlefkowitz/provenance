'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- artworks/exhibitions RLS queries use loosely typed Supabase rows */

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export type UpdateExhibitionListingResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Inline-edit the title and/or artist name of a DRAFT exhibition listing from the
 * exhibition page, so the host can fill in missing artist names while building the show.
 * Only the exhibition owner who created the draft listing may edit it.
 */
export async function updateExhibitionListing(params: {
  exhibitionId: string;
  artworkId: string;
  title?: string;
  artistName?: string;
}): Promise<UpdateExhibitionListingResult> {
  const { exhibitionId, artworkId } = params;

  console.log('[Exhibitions] updateExhibitionListing started', { exhibitionId, artworkId });

  if (params.title === undefined && params.artistName === undefined) {
    return { success: false, error: 'Nothing to update.' };
  }

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] updateExhibitionListing: not authenticated');
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: exErr } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (exErr || !exhibition || exhibition.gallery_id !== user.id) {
    console.error('[Exhibitions] updateExhibitionListing: exhibition access denied', exErr);
    return { success: false, error: 'Exhibition not found or access denied.' };
  }

  const { data: link, error: linkErr } = await (client as any)
    .from('exhibition_artworks')
    .select('artwork_id')
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', artworkId)
    .maybeSingle();

  if (linkErr || !link) {
    console.error('[Exhibitions] updateExhibitionListing: artwork not in exhibition', linkErr);
    return { success: false, error: 'This artwork is not part of this exhibition.' };
  }

  const { data: artwork, error: artErr } = await (client as any)
    .from('artworks')
    .select('id, account_id, status')
    .eq('id', artworkId)
    .maybeSingle();

  if (artErr || !artwork) {
    console.error('[Exhibitions] updateExhibitionListing: artwork not found', artErr);
    return { success: false, error: 'Artwork not found.' };
  }

  if (artwork.account_id !== user.id) {
    return { success: false, error: 'You can only edit listings you created.' };
  }

  if (artwork.status !== 'draft') {
    return { success: false, error: 'Only draft listings can be edited from here.' };
  }

  const updatePayload: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (params.title !== undefined) {
    const title = params.title.trim();
    if (!title) {
      return { success: false, error: 'Title cannot be empty.' };
    }
    updatePayload.title = title.slice(0, 300);
  }

  if (params.artistName !== undefined) {
    const artistName = params.artistName.trim();
    updatePayload.artist_name = artistName ? artistName.slice(0, 200) : null;
  }

  const { error: upErr } = await (client as any)
    .from('artworks')
    .update(updatePayload)
    .eq('id', artworkId)
    .eq('account_id', user.id)
    .eq('status', 'draft');

  if (upErr) {
    console.error('[Exhibitions] updateExhibitionListing: update failed', upErr);
    return { success: false, error: upErr.message || 'Failed to update listing.' };
  }

  console.log('[Exhibitions] updateExhibitionListing success', { artworkId });

  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/artworks/${artworkId}`);
  revalidatePath(`/artworks/${artworkId}/certificate`);

  return { success: true };
}
