import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArtworkCard } from './_components/artwork-card';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Artworks | Provenance',
};

export default async function ArtworksPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  let artworks = null;
  let error = null;

  if (!user) {
    // Not signed in - show all verified artworks as a public feed
    const result = await client
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(50);
    
    artworks = result.data;
    error = result.error;
  } else {
    // Signed in - show only artworks from:
    // 1. The current user
    // 2. Artists the user follows
    
    // First, get the list of users this user follows
    const { data: following } = await client
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);
    
    const followingIds = following?.map(f => f.following_id) || [];
    
    // Include the current user's ID to show their own artworks
    const accountIdsToShow = [user.id, ...followingIds];
    
    // Fetch artworks from these accounts
    const result = await client
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
      .eq('status', 'verified')
      .in('account_id', accountIdsToShow)
      .order('created_at', { ascending: false })
      .limit(50);
    
    artworks = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Error fetching artworks:', error);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Artworks
          </h1>
          <p className="text-ink/70 font-serif">
            {user ? 'Your artworks and artists you follow' : 'Recent uploads and verified artworks'}
          </p>
        </div>
        {user && (
          <Button
            asChild
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            <Link href="/artworks/add">Add Artwork</Link>
          </Button>
        )}
      </div>

      {!user && (
        <div className="mb-8 p-6 bg-parchment/50 border border-wine/20 rounded-lg">
          <p className="text-ink/70 font-serif mb-4">
            Sign in to add your own artworks and create certificates of authenticity.
          </p>
          <Button asChild variant="outline" className="font-serif">
            <Link href="/auth/sign-in">Sign In</Link>
          </Button>
        </div>
      )}

      {artworks && artworks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {artworks.map((artwork) => (
            <ArtworkCard 
              key={artwork.id} 
              artwork={artwork}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-ink/70 font-serif text-lg mb-4">
            {user 
              ? 'No artworks yet. Add an artwork or follow artists to see their work here.' 
              : 'No artworks yet'}
          </p>
          {user && (
            <div className="flex gap-4 justify-center">
              <Button
                asChild
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                <Link href="/artworks/add">Add Your First Artwork</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="font-serif border-wine/30 hover:bg-wine/10"
              >
                <Link href="/artists">Discover Artists</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
