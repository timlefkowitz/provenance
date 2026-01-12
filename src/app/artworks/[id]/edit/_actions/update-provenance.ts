'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function updateProvenance(
  artworkId: string,
  provenance: {
    title: string;
    creationDate: string;
    dimensions: string;
    formerOwners: string;
    auctionHistory: string;
    exhibitionHistory: string;
    historicContext: string;
    celebrityNotes: string;
    isPublic?: boolean;
    value?: string;
    valueIsPublic?: boolean;
    edition?: string;
    productionLocation?: string;
    ownedBy?: string;
    ownedByIsPublic?: boolean;
  }
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update provenance' };
    }

    // Verify the user owns this artwork
    const { data: artwork, error: fetchError } = await (client as any)
      .from('artworks')
      .select('account_id')
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      return { error: 'Artwork not found' };
    }

    if (artwork.account_id !== user.id) {
      return { error: 'You do not have permission to edit this artwork' };
    }

    // Update title, provenance fields and privacy
    const updateData: any = {
      title: provenance.title?.trim() || null,
      creation_date: provenance.creationDate || null,
      dimensions: provenance.dimensions || null,
      former_owners: provenance.formerOwners || null,
      auction_history: provenance.auctionHistory || null,
      exhibition_history: provenance.exhibitionHistory || null,
      historic_context: provenance.historicContext || null,
      celebrity_notes: provenance.celebrityNotes || null,
      updated_by: user.id,
    };

    // Only update is_public if it's provided
    if (provenance.isPublic !== undefined) {
      updateData.is_public = provenance.isPublic;
    }

    // Add new fields
    if (provenance.value !== undefined) {
      updateData.value = provenance.value || null;
    }
    if (provenance.valueIsPublic !== undefined) {
      updateData.value_is_public = provenance.valueIsPublic;
    }
    if (provenance.edition !== undefined) {
      updateData.edition = provenance.edition || null;
    }
    if (provenance.productionLocation !== undefined) {
      updateData.production_location = provenance.productionLocation || null;
    }
    if (provenance.ownedBy !== undefined) {
      updateData.owned_by = provenance.ownedBy || null;
    }
    if (provenance.ownedByIsPublic !== undefined) {
      updateData.owned_by_is_public = provenance.ownedByIsPublic;
    }

    const { error } = await (client as any)
      .from('artworks')
      .update(updateData)
      .eq('id', artworkId);

    if (error) {
      console.error('Error updating provenance:', error);
      return { error: error.message || 'Failed to update provenance' };
    }

    revalidatePath(`/artworks/${artworkId}`);
    revalidatePath(`/artworks/${artworkId}/certificate`);
    revalidatePath('/artworks'); // Revalidate the artworks feed

    return { success: true };
  } catch (error) {
    console.error('Error in updateProvenance:', error);
    return { error: 'An unexpected error occurred' };
  }
}

