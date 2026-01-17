'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export async function updateExhibition(exhibitionId: string, formData: FormData) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify user is a gallery and owns this exhibition
  const { data: exhibition } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || exhibition.gallery_id !== user.id) {
    throw new Error('Exhibition not found or access denied');
  }

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const userRole = getUserRole(account?.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.GALLERY) {
    throw new Error('Only galleries can update exhibitions');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string | null;
  const location = formData.get('location') as string | null;
  const curator = formData.get('curator') as string | null;
  const theme = formData.get('theme') as string | null;
  const artistIdsJson = formData.get('artistIds') as string | null;

  if (!title || !startDate) {
    throw new Error('Title and start date are required');
  }

  // Get existing metadata
  const { data: existingExhibition } = await (client as any)
    .from('exhibitions')
    .select('metadata')
    .eq('id', exhibitionId)
    .single();

  const existingMetadata = (existingExhibition?.metadata as Record<string, any>) || {};

  // Build updated metadata object
  const metadata: Record<string, any> = { ...existingMetadata };
  if (curator?.trim()) {
    metadata.curator = curator.trim();
  } else {
    delete metadata.curator;
  }
  if (theme?.trim()) {
    metadata.theme = theme.trim();
  } else {
    delete metadata.theme;
  }

  // Update exhibition
  const { error } = await (client as any)
    .from('exhibitions')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      location: location?.trim() || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exhibitionId);

  if (error) {
    console.error('Error updating exhibition:', error);
    throw new Error('Failed to update exhibition');
  }

  // Update artists if provided
  if (artistIdsJson !== null) {
    try {
      const artistIds = JSON.parse(artistIdsJson) as string[];

      // Remove all existing artists
      await (client as any)
        .from('exhibition_artists')
        .delete()
        .eq('exhibition_id', exhibitionId);

      // Add new artists
      if (artistIds.length > 0) {
        const artistInserts = artistIds.map((artistId) => ({
          exhibition_id: exhibitionId,
          artist_account_id: artistId,
        }));

        const { error: artistsError } = await (client as any)
          .from('exhibition_artists')
          .insert(artistInserts);

        if (artistsError) {
          console.error('Error updating artists:', artistsError);
          // Don't throw - exhibition was updated
        }
      }
    } catch (e) {
      console.error('Error parsing artist IDs:', e);
    }
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

