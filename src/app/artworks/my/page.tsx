import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ProfileArtworksSection } from '~/app/profile/_components/profile-artworks-section';

export const metadata = {
  title: 'My Artworks | Provenance',
};

export default async function MyArtworksPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Fetch user's artworks
  const { data: artworks } = await client
    .from('artworks')
    .select(
      'id, title, artist_name, image_url, created_at, certificate_number, description, creation_date',
    )
    .eq('account_id', user.id)
    .eq('status', 'verified')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          My Artworks
        </h1>
        <p className="text-ink/70 font-serif">
          Manage your artworks and create printable labels for art shows.
        </p>
      </div>

      <ProfileArtworksSection artworks={artworks || []} />
    </div>
  );
}
