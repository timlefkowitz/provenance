import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import { slugify } from '~/lib/slug';

export const metadata = {
  title: 'Gallery | Provenance',
};

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const client = getSupabaseServerClient();

  // Decode the name (in case it's URL encoded)
  const decodedName = decodeURIComponent(name);
  const nameSlug = slugify(decodedName);

  // Find gallery profiles - we'll match by slugified name
  const { data: profiles, error } = await client
    .from('user_profiles')
    .select('id, user_id, name')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .limit(100); // Get more results to find slug match

  if (error || !profiles || profiles.length === 0) {
    // No gallery found, redirect to registry
    redirect('/registry');
  }

  // Find exact slug match first
  let matchingProfile = profiles.find(
    (p) => slugify(p.name) === nameSlug
  );

  // If no exact slug match, try partial match
  if (!matchingProfile) {
    matchingProfile = profiles.find(
      (p) => slugify(p.name).includes(nameSlug) || nameSlug.includes(slugify(p.name))
    );
  }

  // If still no match, use first profile (fallback)
  if (!matchingProfile) {
    matchingProfile = profiles[0];
  }

  // Redirect to the proper profile page with role and profileId
  redirect(`/artists/${matchingProfile.user_id}?role=gallery&profileId=${matchingProfile.id}`);
}

