import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionsForGallery } from './_actions/get-exhibitions';
import { ExhibitionsList } from './_components/exhibitions-list';
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Exhibitions | Provenance',
};

export default async function ExhibitionsPage() {
  const client = asUntyped(getSupabaseServerClient());
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

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  if (userRole !== USER_ROLES.GALLERY) {
    redirect('/registry');
  }

  const exhibitions = await getExhibitionsForGallery(user.id);

  return (
    <div className="min-h-screen">
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14">
          <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">Gallery</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink tracking-tight">
            Exhibitions
          </h1>
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-6xl py-10 pb-12">
        <ExhibitionsList exhibitions={exhibitions} galleryId={user.id} />
      </div>
      <SiteLegalFooter />
    </div>
  );
}

