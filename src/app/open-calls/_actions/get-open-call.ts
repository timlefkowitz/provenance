'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type OpenCall = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  submission_open_date: string | null;
  submission_closing_date: string | null;
  call_type: string | null;
  exhibition: {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    location: string | null;
    gallery_id: string;
  };
};

export async function getOpenCallBySlug(slug: string): Promise<OpenCall | null> {
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, submission_open_date, submission_closing_date, call_type, exhibition:exhibition_id (id, title, description, start_date, end_date, location, gallery_id)',
    )
    .eq('slug', slug)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching open call:', error);
    }
    return null;
  }

  return data as OpenCall;
}
