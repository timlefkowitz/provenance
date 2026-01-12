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

  if (!title || !startDate) {
    throw new Error('Title and start date are required');
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
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exhibitionId);

  if (error) {
    console.error('Error updating exhibition:', error);
    throw new Error('Failed to update exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

