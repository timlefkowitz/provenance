import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';

export const metadata = {
  title: 'Gallery | Provenance',
};

export default async function GalleryShortLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getSupabaseServerClient();

  // Find gallery profile by slug
  const { data: profile, error } = await client
    .from('user_profiles')
    .select('id, user_id, name')
    .eq('role', USER_ROLES.GALLERY)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !profile) {
    // Gallery not found, redirect to registry
    redirect('/registry');
  }

  // Redirect to the proper profile page with role and profileId
  redirect(`/artists/${profile.user_id}?role=gallery&profileId=${profile.id}`);
}

