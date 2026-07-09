import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';

export async function GET() {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasProfile: false, isTeamMember: false, teamGalleryName: null });
    }

    // Check if user owns an active gallery profile
    const { data: ownedProfile } = await (client as any)
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (ownedProfile) {
      console.log('[GalleryProfileNotification] user owns a gallery profile', { userId: user.id });
      return NextResponse.json({ hasProfile: true, isTeamMember: false, teamGalleryName: null });
    }

    // Check if user is a member of any gallery team
    const { data: memberRows } = await (client as any)
      .from('gallery_members')
      .select('gallery_profile_id')
      .eq('user_id', user.id)
      .limit(1);

    if (memberRows && memberRows.length > 0) {
      const galleryProfileId = (memberRows[0] as { gallery_profile_id: string }).gallery_profile_id;

      const { data: teamProfile } = await (client as any)
        .from('user_profiles')
        .select('name')
        .eq('id', galleryProfileId)
        .eq('role', USER_ROLES.GALLERY)
        .maybeSingle();

      const teamGalleryName = (teamProfile as { name: string } | null)?.name ?? null;
      console.log('[GalleryProfileNotification] user is on gallery team', { userId: user.id, teamGalleryName });
      return NextResponse.json({ hasProfile: false, isTeamMember: true, teamGalleryName });
    }

    console.log('[GalleryProfileNotification] user has no gallery profile or team', { userId: user.id });
    return NextResponse.json({ hasProfile: false, isTeamMember: false, teamGalleryName: null });
  } catch (error) {
    console.error('[GalleryProfileNotification] Error checking gallery profile:', error);
    return NextResponse.json({ hasProfile: false, isTeamMember: false, teamGalleryName: null });
  }
}
