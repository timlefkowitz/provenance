import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ProfileForm } from '../../_components/profile-form';
import { getUserProfileById } from '../../_actions/get-user-profiles';

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

  if (!profile || profile.user_id !== user.id) {
    redirect('/profiles');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit Profile
        </h1>
        <p className="text-ink/70 font-serif">
          Update your {profile.role} profile information.
        </p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}

