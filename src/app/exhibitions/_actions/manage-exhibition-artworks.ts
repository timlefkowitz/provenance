'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function addArtworkToExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify user owns this exhibition
  const { data: exhibition } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || exhibition.gallery_id !== user.id) {
    throw new Error('Exhibition not found or access denied');
  }

  // Add artwork to exhibition
  const { error } = await (client as any)
    .from('exhibition_artworks')
    .insert({
      exhibition_id: exhibitionId,
      artwork_id: artworkId,
    });

  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') {
      console.error('Error adding artwork to exhibition:', error);
      throw new Error('Failed to add artwork to exhibition');
    }
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

export async function removeArtworkFromExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify user owns this exhibition
  const { data: exhibition } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || exhibition.gallery_id !== user.id) {
    throw new Error('Exhibition not found or access denied');
  }

  // Remove artwork from exhibition
  const { error } = await (client as any)
    .from('exhibition_artworks')
    .delete()
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', artworkId);

  if (error) {
    console.error('Error removing artwork from exhibition:', error);
    throw new Error('Failed to remove artwork from exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

