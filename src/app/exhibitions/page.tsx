import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionsForGallery } from './_actions/get-exhibitions';
import { ExhibitionsList } from './_components/exhibitions-list';

export const metadata = {
  title: 'Exhibitions | Provenance',
};

export default async function ExhibitionsPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify user is a gallery
  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.GALLERY) {
    redirect('/registry');
  }

  const exhibitions = await getExhibitionsForGallery(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Exhibitions
        </h1>
        <p className="text-ink/70 font-serif">
          Manage your gallery exhibitions and shows
        </p>
      </div>

      <ExhibitionsList exhibitions={exhibitions} galleryId={user.id} />
    </div>
  );
}

