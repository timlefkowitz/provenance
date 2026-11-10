import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ProfileForm } from '../../_components/profile-form';
import { getUserProfileById } from '../../_actions/get-user-profiles';
import { GalleryMembersManager } from '../../_components/gallery-members-manager';
import { DeleteProfileButton } from '../../_components/delete-profile-button';
import { isTeamProfileRole, USER_ROLES } from '~/lib/user-roles';
import Link from 'next/link';
import { getMyProfileSuggestions } from '../../_actions/profile-suggestions';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Edit Profile | Provenance',
};

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const client = asUntyped(getSupabaseServerClient());
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

  if (!isOwner && isTeamProfileRole(profile.role)) {
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

  const pendingSuggestions =
    isOwner && profile.role === USER_ROLES.ARTIST
      ? (await getMyProfileSuggestions()).filter((s) => s.profileId === profile.id).length
      : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {pendingSuggestions > 0 && (
        <Link
          href="/profiles/suggestions"
          className="mb-6 block rounded-xl border border-wine/25 bg-wine/5 px-4 py-3 font-serif text-sm text-wine hover:bg-wine/10"
        >
          A curator suggested {pendingSuggestions === 1 ? 'updates' : `${pendingSuggestions} sets of updates`} to
          this profile. Review them →
        </Link>
      )}
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

        {/* Gallery / Institution Team Members Section */}
        {isTeamProfileRole(profile.role) && (
          <GalleryMembersManager 
            galleryProfileId={id} 
            userId={user.id}
            entityLabel={profile.role === USER_ROLES.INSTITUTION ? 'institution' : 'gallery'}
          />
        )}

        {/* Danger Zone — only owners can delete */}
        {isOwner && (
          <DeleteProfileButton
            profileId={profile.id}
            profileName={profile.name}
            profileRole={profile.role}
          />
        )}
      </div>
    </div>
  );
}

