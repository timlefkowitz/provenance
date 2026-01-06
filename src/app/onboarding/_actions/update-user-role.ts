'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export async function updateUserRole(role: string) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get existing public data
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const currentPublicData = (account?.public_data as Record<string, any>) || {};

  // Update public_data with new role
  const { error } = await client
    .from('accounts')
    .update({
      public_data: {
        ...currentPublicData,
        role,
      },
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/', 'layout');
}


