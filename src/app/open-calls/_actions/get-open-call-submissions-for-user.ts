'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type OpenCallSubmission = {
  id: string;
  created_at: string;
  artworks: Array<{ url: string; filename: string }>;
  open_call: {
    id: string;
    slug: string;
    exhibition: {
      id: string;
      title: string;
      start_date: string;
      end_date: string | null;
    };
  };
};

export async function getOpenCallSubmissionsForUser(userId: string) {
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await (admin as any)
    .from('open_call_submissions')
    .select(
      'id, created_at, artworks, open_call:open_call_id (id, slug, exhibition:exhibition_id (id, title, start_date, end_date))',
    )
    .eq('account_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching open call submissions:', error);
    return [];
  }

  return (data || []) as OpenCallSubmission[];
}
