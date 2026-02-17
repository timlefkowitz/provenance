import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ProfileForm } from '../../_components/profile-form';
import { getUserProfileById } from '../../_actions/get-user-profiles';
import { GalleryMembersManager } from '../../_components/gallery-members-manager';
import { USER_ROLES } from '~/lib/user-roles';

export const metadata = {
  title: 'Edit Profile | Provenance',
};

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { id } = await params;
  const profile = await getUserProfileById(id);

  if (!profile) {
    redirect('/profiles');
  }

  // Check if user owns the profile or is a gallery member
  const isOwner = profile.user_id === user.id;
  let isGalleryMember = false;

  if (!isOwner && profile.role === USER_ROLES.GALLERY) {
    const { data: member } = await client
      .from('gallery_members')
      .select('id')
      .eq('gallery_profile_id', id)
      .eq('user_id', user.id)
      .single();

    isGalleryMember = !!member;
  }

  if (!isOwner && !isGalleryMember) {
    redirect('/profiles');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit Profile
        </h1>
        <p className="text-ink/70 font-serif">
          Update your {profile.role} profile information.
        </p>
      </div>

      <div className="space-y-6">
        <ProfileForm profile={profile} />

        {/* Gallery Team Members Section */}
        {profile.role === USER_ROLES.GALLERY && (
          <GalleryMembersManager 
            galleryProfileId={id} 
            userId={user.id}
          />
        )}
      </div>
    </div>
  );
}

