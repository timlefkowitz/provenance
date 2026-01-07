import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';
import { getAboutContent } from './_actions/about-content';
import { EditAboutForm } from './_components/edit-about-form';

export const metadata = {
  title: 'Edit About Page | Admin | Provenance',
};

export default async function AdminAboutPage() {
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

  // Load about content
  const content = await getAboutContent();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit About Page
        </h1>
        <p className="text-ink/70 font-serif">
          Update the content of the about page. Changes are saved to a file and do not affect the database.
        </p>
      </div>

      <div className="bg-parchment border-4 border-double border-wine p-6">
        <EditAboutForm initialContent={content} />
      </div>
    </div>
  );
}

