import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { QueuedArtworksList } from './_components/queued-artworks-list';

export const metadata = {
  title: 'Queued Artworks | Admin | Provenance',
};

export default async function QueuedArtworksPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin(user.id);

  if (!userIsAdmin) {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Queued Artworks
        </h1>
        <p className="text-ink/70 font-serif">
          View verified artworks that are available to be featured on the homepage
        </p>
      </div>

      <QueuedArtworksList />
    </div>
  );
}

