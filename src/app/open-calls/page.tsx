import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, isTeamProfileRole } from '~/lib/user-roles';
import { getOpenCallsForGallery } from './_actions/get-open-calls-for-gallery';
import { getUserProfiles } from '../profiles/_actions/get-user-profiles';
import { OpenCallsManager } from './_components/open-calls-manager';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Open Calls | Provenance',
};

export default async function OpenCallsPage() {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  if (!isTeamProfileRole(userRole)) {
    redirect('/registry');
  }

  const [openCalls, profiles] = await Promise.all([
    getOpenCallsForGallery(user.id),
    getUserProfiles(user.id),
  ]);

  // Profiles of the current mode: gallery profiles for galleries, institution profiles for institutions
  const galleryProfiles = profiles.filter((profile) => profile.role === userRole);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Open Calls
        </h1>
        <p className="text-ink/70 font-serif">
          Create public open calls for upcoming exhibitions
        </p>
      </div>

      <OpenCallsManager openCalls={openCalls} galleryProfiles={galleryProfiles} />
    </div>
  );
}
