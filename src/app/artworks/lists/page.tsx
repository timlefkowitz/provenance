import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';

import { listMyLists } from '../_actions/artwork-lists';
import { ListsIndex } from './_components/lists-index';

export const metadata = {
  title: 'Lists | Provenance',
};

export default async function ArtworkListsPage() {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/auth/sign-in?next=/artworks/lists');

  const lists = await listMyLists();

  return (
    <div className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-3xl sm:text-4xl text-wine">Lists</h1>
        <p className="mt-2 max-w-xl font-serif text-sm text-ink/65">
          Private lists of your works — a “To print” queue for wall labels, works that still need their info, a
          room to hang. Add works from a photo scan, a certificate, or your collection.
        </p>
        <ListsIndex initialLists={lists} />
      </div>
    </div>
  );
}
