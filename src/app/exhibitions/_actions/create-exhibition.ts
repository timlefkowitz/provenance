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

  if (!title || !startDate) {
    throw new Error('Title and start date are required');
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
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating exhibition:', error);
    throw new Error('Failed to create exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  return { success: true, exhibitionId: exhibition.id };
}

