'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type OpenCall = {
  id: string;
  slug: string;
  gallery_profile_id: string;
  submission_open_date: string | null;
  submission_closing_date: string | null;
  call_type: string | null;
  medium: string | null;
  external_url: string | null;
  /** Main image the organiser picked for the call. */
  image_url: string | null;
  /** 'exhibition' = submit through the exhibition upload flow. */
  submission_mode: string;
  exhibition: {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    location: string | null;
    gallery_id: string;
    metadata: Record<string, unknown> | null;
  };
};

export async function getOpenCallBySlug(slug: string): Promise<OpenCall | null> {
  // Admin client: an open call is public even while its exhibition is a
  // private draft; only the fields below are exposed.
  const client = asUntyped(getSupabaseServerAdminClient());

  const { data, error } = await asUntyped(client)
    .from('open_calls')
    .select(
      'id, slug, gallery_profile_id, submission_open_date, submission_closing_date, call_type, medium, external_url, image_url, submission_mode, exhibition:exhibition_id (id, title, description, start_date, end_date, location, gallery_id, metadata)',
    )
    .eq('slug', slug)
    .single();

  if (error || !data || !data.exhibition) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching open call:', error);
    }
    return null;
  }

  return data as unknown as OpenCall;
}
