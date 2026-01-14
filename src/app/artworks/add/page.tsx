import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole } from '~/lib/user-roles';
import { AddArtworkPageContent } from './_components/add-artwork-page-content';
import { getUserExhibitions } from './_actions/get-user-exhibitions';

export const metadata = {
  title: 'Add Artwork | Provenance',
};

export default async function AddArtworkPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account name, medium, and role for auto-filling
  const { data: account } = await client
    .from('accounts')
    .select('name, public_data')
    .eq('id', user.id)
    .single();

  const artistName = account?.name || '';
  const defaultMedium = (account?.public_data as any)?.medium || '';
  const userRole = getUserRole(account?.public_data as Record<string, any>);
  
  // Get exhibitions for galleries
  const exhibitions = await getUserExhibitions(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <AddArtworkPageContent
        userId={user.id}
        defaultArtistName={artistName}
        defaultMedium={defaultMedium}
        userRole={userRole}
        exhibitions={exhibitions}
      />
    </div>
  );
}
