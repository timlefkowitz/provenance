'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export async function createExhibition(formData: FormData) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify user is a gallery
  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.GALLERY) {
    throw new Error('Only galleries can create exhibitions');
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

  // Parse artist IDs
  let artistIds: string[] = [];
  if (artistIdsJson) {
    try {
      artistIds = JSON.parse(artistIdsJson);
    } catch (e) {
      console.error('Error parsing artist IDs:', e);
    }
  }

  // Build metadata object
  const metadata: Record<string, any> = {};
  if (curator?.trim()) {
    metadata.curator = curator.trim();
  }
  if (theme?.trim()) {
    metadata.theme = theme.trim();
  }

  // Create exhibition
  const { data: exhibition, error } = await (client as any)
    .from('exhibitions')
    .insert({
      gallery_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      location: location?.trim() || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating exhibition:', error);
    throw new Error('Failed to create exhibition');
  }

  // Add artists to exhibition
  if (artistIds.length > 0) {
    const artistInserts = artistIds.map((artistId) => ({
      exhibition_id: exhibition.id,
      artist_account_id: artistId,
    }));

    const { error: artistsError } = await (client as any)
      .from('exhibition_artists')
      .insert(artistInserts);

    if (artistsError) {
      console.error('Error adding artists to exhibition:', artistsError);
      // Don't throw - exhibition was created, artists can be added later
    }
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true, exhibitionId: exhibition.id };
}

