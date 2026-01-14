'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export type UserExhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export async function getUserExhibitions(userId: string): Promise<UserExhibition[]> {
  const client = getSupabaseServerClient();
  
  // Get user role
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', userId)
    .single();

  if (!account) {
    return [];
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  
  // Only galleries have exhibitions
  if (userRole !== USER_ROLES.GALLERY) {
    return [];
  }

  // Get exhibitions for this gallery
  const { data, error } = await (client as any)
    .from('exhibitions')
    .select('id, title, start_date, end_date')
    .eq('gallery_id', userId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching exhibitions:', error);
    return [];
  }

  return data || [];
}

