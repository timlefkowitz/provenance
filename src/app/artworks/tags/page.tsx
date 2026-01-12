import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ArtworkTags } from './_components/artwork-tags';
import { PrintButton } from './_components/print-button';

export const metadata = {
  title: 'Artwork Tags | Provenance',
};

export default async function ArtworkTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const artworkIds = params.ids?.split(',').filter(Boolean) || [];

  if (artworkIds.length === 0) {
    redirect('/profile');
  }

  // Fetch the selected artworks
  const { data: artworks, error } = await client
    .from('artworks')
    .select(
      'id, title, artist_name, description, creation_date, certificate_number, account_id',
    )
    .in('id', artworkIds)
    .eq('account_id', user.id) // Ensure user can only see their own artworks
    .eq('status', 'verified');

  if (error || !artworks || artworks.length === 0) {
    redirect('/profile');
  }

  // Get site URL for QR codes
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 print:hidden">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Artwork Tags
        </h1>
        <p className="text-ink/70 font-serif mb-4">
          Print this page and cut along the dotted lines to create tags for your artworks.
        </p>
        <PrintButton />
      </div>
      <ArtworkTags artworks={artworks} siteUrl={siteUrl} />
    </div>
  );
}

