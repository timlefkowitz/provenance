import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import Link from 'next/link';
import { ArtworkCard } from './_components/artwork-card';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Artworks | Provenance',
};

// Enable dynamic rendering for real-time data
export const dynamic = 'force-dynamic';
// Revalidate every 60 seconds for fresh data
export const revalidate = 60;

const ARTWORKS_PER_PAGE = 12;

export default async function ArtworksPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const offset = (page - 1) * ARTWORKS_PER_PAGE;
  
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  let artworks = null;
  let error = null;
  let totalCount = 0;

  if (!user) {
    // Not signed in: use admin client so public feed is always readable (bypasses RLS).
    // We still filter to status=verified and is_public=true, so only public data is exposed.
    try {
      const admin = getSupabaseServerAdminClient();
      const [countResult, artworksResult] = await Promise.all([
        admin
          .from('artworks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'verified')
          .eq('is_public', true),
        admin
          .from('artworks')
          .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
          .eq('status', 'verified')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .range(offset, offset + ARTWORKS_PER_PAGE - 1)
      ]);

      totalCount = countResult.count ?? 0;
      artworks = artworksResult.data ?? [];
      error = artworksResult.error;
    } catch (err) {
      console.error('Exception in anonymous artworks fetch:', err);
      error = err as Error;
      artworks = [];
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
    
    // Get total count for pagination
    const { count: ownCount } = await (client as any)
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')
      .eq('account_id', user.id);
    
    const { count: publicCount } = await (client as any)
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')
      .eq('is_public', true)
      .neq('account_id', user.id);
    
    totalCount = (ownCount || 0) + (publicCount || 0);
    
    // Fetch:
    // - User's own artworks (all, regardless of privacy)
    // - Public artworks from others (including followed artists)
    const [ownArtworksResult, publicArtworksResult] = await Promise.all([
      (client as any)
        .from('artworks')
        .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
        .eq('status', 'verified')
        .eq('account_id', user.id)
        .order('created_at', { ascending: false }),
      (client as any)
        .from('artworks')
        .select('id, title, artist_name, image_url, created_at, certificate_number, account_id')
        .eq('status', 'verified')
        .eq('is_public', true)
        .neq('account_id', user.id)
        .order('created_at', { ascending: false })
    ]);
    
    // Log errors for debugging
    if (ownArtworksResult.error) {
      console.error('Error fetching own artworks:', ownArtworksResult.error);
    }
    if (publicArtworksResult.error) {
      console.error('Error fetching public artworks:', publicArtworksResult.error);
    }
    
    // Combine and sort by created_at, then paginate
    const allArtworks = [
      ...(ownArtworksResult.data || []),
      ...(publicArtworksResult.data || [])
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    artworks = allArtworks.slice(offset, offset + ARTWORKS_PER_PAGE);
    error = ownArtworksResult.error || publicArtworksResult.error || null;
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {artworks.map((artwork) => (
              <ArtworkCard 
                key={artwork.id} 
                artwork={artwork}
                currentUserId={user?.id}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalCount > ARTWORKS_PER_PAGE && (
            <div className="mt-8 flex items-center justify-center gap-4">
              {page > 1 && (
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href={`/artworks?page=${page - 1}`}>
                    Previous
                  </Link>
                </Button>
              )}
              <span className="text-ink/70 font-serif text-sm">
                Page {page} of {Math.ceil(totalCount / ARTWORKS_PER_PAGE)}
              </span>
              {page < Math.ceil(totalCount / ARTWORKS_PER_PAGE) && (
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href={`/artworks?page=${page + 1}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          )}
        </>
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
