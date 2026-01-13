import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ProfileForm } from '../_components/profile-form';
import { isValidRole, getRoleLabel } from '~/lib/user-roles';

export const metadata = {
  title: 'Create Profile | Provenance',
};

export default async function CreateProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const params = await searchParams;
  const role = params.role;

  if (!role || !isValidRole(role)) {
    redirect('/profiles');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Create {getRoleLabel(role)} Profile
        </h1>
        <p className="text-ink/70 font-serif">
          Set up your {getRoleLabel(role).toLowerCase()} profile. This will be your public-facing profile for this role.
        </p>
      </div>

      <ProfileForm role={role} />
    </div>
  );
}

