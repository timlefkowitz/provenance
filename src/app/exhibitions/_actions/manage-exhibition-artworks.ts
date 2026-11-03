'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { notifyOwnersOfExhibition } from '~/lib/collectors/notify-owners-of-exhibition';

export async function addArtworkToExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Owner or gallery team member (e.g. the registrar)
  const { data: exhibition } = await asUntyped(client)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Exhibition not found or access denied');
  }

  // Add artwork to exhibition
  const { error } = await asUntyped(client)
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

  await notifyOwnersOfExhibition({ exhibitionId, artworkIds: [artworkId], actorUserId: user.id });

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/artists/${exhibition.gallery_id}`);

  return { success: true };
}

export async function removeArtworkFromExhibition(exhibitionId: string, artworkId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Owner or gallery team member (e.g. the registrar)
  const { data: exhibition } = await asUntyped(client)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Exhibition not found or access denied');
  }

  // Remove artwork from exhibition
  const { error } = await asUntyped(client)
    .from('exhibition_artworks')
    .delete()
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', artworkId);

  if (error) {
    console.error('Error removing artwork from exhibition:', error);
    throw new Error('Failed to remove artwork from exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/artists/${exhibition.gallery_id}`);

  return { success: true };
}

