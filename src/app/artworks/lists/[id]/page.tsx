import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';

import { getListWithArtworks } from '../../_actions/artwork-lists';
import { ListDetail } from '../_components/list-detail';

export const metadata = {
  title: 'List | Provenance',
};

export default async function ArtworkListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/artworks/lists/${id}`);

  const result = await getListWithArtworks(id);
  if (!result) notFound();

  const { data: account } = await client.from('accounts').select('name').eq('id', user.id).maybeSingle();

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <ListDetail
          list={result.list}
          artworks={result.artworks}
          galleryName={(account?.name as string | null) || 'Provenance'}
        />
      </div>
    </div>
  );
}
