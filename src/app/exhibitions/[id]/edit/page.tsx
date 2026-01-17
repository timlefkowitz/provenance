import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionWithDetails } from '../../_actions/get-exhibitions';
import { ExhibitionForm } from '../../_components/exhibition-form';

export const metadata = {
  title: 'Edit Exhibition | Provenance',
};

export default async function EditExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify user is a gallery
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.GALLERY) {
    redirect('/registry');
  }

  // Get exhibition with details
  const exhibition = await getExhibitionWithDetails(id);

  if (!exhibition || exhibition.gallery_id !== user.id) {
    redirect('/exhibitions');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit Exhibition
        </h1>
        <p className="text-ink/70 font-serif">
          Update exhibition details
        </p>
      </div>

      <ExhibitionForm exhibition={exhibition} />
    </div>
  );
}

