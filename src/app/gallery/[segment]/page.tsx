import { permanentRedirect, redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import { isGalleryProfileUuid } from '~/lib/gallery-public-slug';

export const metadata = {
  title: 'Gallery | Provenance',
};

function galleryProfileRedirect(userId: string, profileId: string) {
  return `/artists/${userId}?role=gallery&profileId=${profileId}`;
}

export default async function GallerySegmentPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment: raw } = await params;
  const segment = decodeURIComponent(raw).trim();

  if (!segment) {
    redirect('/registry');
  }

  const client = getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;

  if (isGalleryProfileUuid(segment)) {
    console.log('[Gallery URL] resolve by profile id', { segment });
    const { data: profile, error } = await sb
      .from('user_profiles')
      .select('id, user_id, name')
      .eq('id', segment)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[Gallery URL] profile id lookup failed', error);
      redirect('/registry');
    }
    if (!profile?.user_id) {
      redirect('/registry');
    }

    permanentRedirect(galleryProfileRedirect(profile.user_id, profile.id));
  }

  console.log('[Gallery URL] resolve by slug', { segment });
  const { data: profile, error } = await sb
    .from('user_profiles')
    .select('id, user_id, name')
    .eq('role', USER_ROLES.GALLERY)
    .eq('slug', segment)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[Gallery URL] slug lookup failed', error);
    redirect('/registry');
  }
  if (!profile?.user_id) {
    redirect('/registry');
  }

  permanentRedirect(galleryProfileRedirect(profile.user_id, profile.id));
}
