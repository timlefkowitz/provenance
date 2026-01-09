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
    // Not signed in - show only public verified artworks
    const result = await client
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
      .eq('status', 'verified')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    artworks = result.data || [];
    error = result.error;
    
    // Log for debugging if no artworks found
    if (!error && (!artworks || artworks.length === 0)) {
      console.log('No public verified artworks found for anonymous users');
    }
  } else {
    // Signed in - show:
    // 1. All artworks from the current user (public and private)
    // 2. Public artworks from others (including followed artists)
    
    // First, get the list of users this user follows
    const { data: following } = await client
      .from('user_follows')
      .select('followed_user_id')
      .eq('follower_user_id', user.id);
    
    const followingIds = following?.map(f => f.followed_user_id) || [];
    
    // Fetch:
    // - User's own artworks (all, regardless of privacy)
    // - Public artworks from others (including followed artists)
    const { data: ownArtworks } = await client
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
      .eq('status', 'verified')
      .eq('account_id', user.id);
    
    const { data: publicArtworks } = await client
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
      .eq('status', 'verified')
      .eq('is_public', true)
      .neq('account_id', user.id) // Exclude user's own artworks (already fetched)
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Combine and sort by created_at
    const allArtworks = [
      ...(ownArtworks || []),
      ...(publicArtworks || [])
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 50); // Limit to 50 total
    
    artworks = allArtworks;
    error = null; // We handle errors per query above
  }

  if (error) {
    console.error('Error fetching artworks:', error);
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-wine mb-2">
            Artworks
          </h1>
          <p className="text-sm sm:text-base text-ink/70 font-serif">
            {user ? 'Your artworks and recent public works' : 'Recent public artworks'}
          </p>
        </div>
        {user && (
          <Button
            asChild
            className="bg-wine text-parchment hover:bg-wine/90 font-serif w-full sm:w-auto"
            size="sm"
          >
            <Link href="/artworks/add">Add Artwork</Link>
          </Button>
        )}
      </div>

      {!user && (
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-parchment/50 border border-wine/20 rounded-lg">
          <p className="text-sm sm:text-base text-ink/70 font-serif mb-4">
            Sign in to add your own artworks and create certificates of authenticity.
          </p>
          <Button asChild variant="outline" className="font-serif w-full sm:w-auto" size="sm">
            <Link href="/auth/sign-in">Sign In</Link>
          </Button>
        </div>
      )}

      {artworks && artworks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {artworks.map((artwork) => (
            <ArtworkCard 
              key={artwork.id} 
              artwork={artwork}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16">
          <p className="text-ink/70 font-serif text-base sm:text-lg mb-4 px-4">
            {user 
              ? 'No artworks yet. Add an artwork or follow artists to see their work here.' 
              : 'No artworks yet'}
          </p>
          {user && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button
                asChild
                className="bg-wine text-parchment hover:bg-wine/90 font-serif w-full sm:w-auto"
                size="sm"
              >
                <Link href="/artworks/add">Add Your First Artwork</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="font-serif border-wine/30 hover:bg-wine/10 w-full sm:w-auto"
                size="sm"
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
