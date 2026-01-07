import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { FeaturedArtworksManager } from './_components/featured-artworks-manager';
import { Button } from '@kit/ui/button';

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
        {/* Edit About Page */}
        <div className="border-4 border-double border-wine p-6 bg-parchment">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-wine mb-2">
                About Page
              </h2>
              <p className="text-ink/70 font-serif text-sm">
                Edit the content of the about page. Changes are saved to a file and do not affect the database.
              </p>
            </div>
            <Button
              asChild
              className="bg-wine text-parchment hover:bg-wine/90"
            >
              <Link href="/admin/about">Edit About Page</Link>
            </Button>
          </div>
        </div>

        <FeaturedArtworksManager />
      </div>
    </div>
  );
}

