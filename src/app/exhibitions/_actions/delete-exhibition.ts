'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canAdminExhibition } from '~/app/profiles/_actions/gallery-members';

export async function deleteExhibition(exhibitionId: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Gallery owner, or an owner/admin on the gallery's team
  const { data: exhibition } = await asUntyped(client)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (!exhibition || !(await canAdminExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Exhibition not found or access denied');
  }

  // Delete exhibition (cascade will handle junction tables)
  const { error } = await asUntyped(client)
    .from('exhibitions')
    .delete()
    .eq('id', exhibitionId);

  if (error) {
    console.error('Error deleting exhibition:', error);
    throw new Error('Failed to delete exhibition');
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${exhibition.gallery_id}`);

  return { success: true };
}

