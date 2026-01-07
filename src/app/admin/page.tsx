import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { FeaturedArtworksManager } from './_components/featured-artworks-manager';

export const metadata = {
  title: 'Admin | Provenance',
};

export default async function AdminPage() {
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Admin Panel
        </h1>
        <p className="text-ink/70 font-serif">
          Manage site content and featured entries
        </p>
      </div>

      <div className="space-y-6">
        <FeaturedArtworksManager />
      </div>
    </div>
  );
}

