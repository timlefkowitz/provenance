'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function addArtistToExhibition(exhibitionId: string, artistAccountId: string) {
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

  // Add artist to exhibition
  const { error } = await (client as any)
    .from('exhibition_artists')
    .insert({
      exhibition_id: exhibitionId,
      artist_account_id: artistAccountId,
    });

  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') {
      console.error('Error adding artist to exhibition:', error);
      throw new Error('Failed to add artist to exhibition');
    }
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

export async function removeArtistFromExhibition(exhibitionId: string, artistAccountId: string) {
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

  // Remove artist from exhibition
  const { error } = await (client as any)
    .from('exhibition_artists')
    .delete()
    .eq('exhibition_id', exhibitionId)
    .eq('artist_account_id', artistAccountId);

  if (error) {
    console.error('Error removing artist from exhibition:', error);
    throw new Error('Failed to remove artist from exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

