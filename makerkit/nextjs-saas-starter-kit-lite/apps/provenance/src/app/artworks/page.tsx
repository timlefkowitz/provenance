import { getSupabaseServerClient } from '@kit/supabase/server-client';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArtworksGrid, type ArtworkRow } from './_components/artworks-grid';
import { ArtworksFilterBar, type ArtworkFilter } from './_components/artworks-filter-bar';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Artworks | Provenance',
};

function applyFilter(artworks: ArtworkRow[], filter: ArtworkFilter): ArtworkRow[] {
  switch (filter) {
    case 'recent': {
      return [...artworks].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    case 'trending': {
      // Proxy: artworks uploaded in the last 14 days, sorted by recency,
      // then remaining artworks appended sorted by recency.
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recent = artworks.filter((a) => new Date(a.created_at).getTime() >= cutoff);
      const older = artworks.filter((a) => new Date(a.created_at).getTime() < cutoff);

      // Within trending window, prefer artists with multiple recent uploads
      const artistRecentCount: Record<string, number> = {};
      for (const a of recent) {
        artistRecentCount[a.account_id] = (artistRecentCount[a.account_id] ?? 0) + 1;
      }

      recent.sort((a, b) => {
        const diff = (artistRecentCount[b.account_id] ?? 0) - (artistRecentCount[a.account_id] ?? 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      older.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return [...recent, ...older];
    }

    case 'diverse': {
      // Recent, but cap each artist at 3 artworks
      const sorted = [...artworks].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const artistCount: Record<string, number> = {};
      const result: ArtworkRow[] = [];
      for (const artwork of sorted) {
        const count = artistCount[artwork.account_id] ?? 0;
        if (count < 3) {
          result.push(artwork);
          artistCount[artwork.account_id] = count + 1;
        }
      }
      return result;
    }

    case 'favorites': {
      // Sort by view_count descending (most viewed = most favorited proxy).
      // Falls back to recency when view_count is unavailable.
      return [...artworks].sort((a, b) => {
        const aViews = a.view_count ?? 0;
        const bViews = b.view_count ?? 0;
        if (bViews !== aViews) return bViews - aViews;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    default:
      return artworks;
  }
}

const VALID_FILTERS: ArtworkFilter[] = ['recent', 'trending', 'diverse', 'favorites'];

function isValidFilter(value: string | undefined): value is ArtworkFilter {
  return VALID_FILTERS.includes(value as ArtworkFilter);
}

export default async function ArtworksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const activeFilter: ArtworkFilter = isValidFilter(rawFilter) ? rawFilter : 'recent';

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  let artworks: ArtworkRow[] | null = null;
  let error = null;

  const selectFields =
    'id, title, artist_name, image_url, created_at, certificate_number, account_id, is_sold, view_count';

  if (!user) {
    const result = await client
      .from('artworks')
      .select(selectFields)
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(100);

    artworks = result.data as ArtworkRow[] | null;
    error = result.error;
  } else {
    const { data: following } = await client
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = following?.map((f) => f.following_id) ?? [];
    const accountIdsToShow = [user.id, ...followingIds];

    const result = await client
      .from('artworks')
      .select(selectFields)
      .eq('status', 'verified')
      .in('account_id', accountIdsToShow)
      .order('created_at', { ascending: false })
      .limit(100);

    artworks = result.data as ArtworkRow[] | null;
    error = result.error;
  }

  if (error) {
    console.error('Error fetching artworks:', error);
  }

  const filtered = applyFilter(artworks ?? [], activeFilter);

  const filterDescriptions: Record<ArtworkFilter, string> = {
    recent: user ? 'Your artworks and artists you follow' : 'Recent uploads and verified artworks',
    trending: 'Artworks gaining momentum lately',
    diverse: 'Recent work — up to 3 per artist',
    favorites: 'Most viewed artworks',
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">Artworks</h1>
          <p className="text-ink/70 font-serif">{filterDescriptions[activeFilter]}</p>
        </div>
        {user && (
          <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
            <Link href="/artworks/add">Add Artwork</Link>
          </Button>
        )}
      </div>

      <div className="mb-8">
        <Suspense>
          <ArtworksFilterBar activeFilter={activeFilter} />
        </Suspense>
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

      {filtered.length > 0 ? (
        <ArtworksGrid artworks={filtered} currentUserId={user?.id} />
      ) : (
        <div className="text-center py-16">
          <p className="text-ink/70 font-serif text-lg mb-4">
            {user
              ? 'No artworks yet. Add an artwork or follow artists to see their work here.'
              : 'No artworks yet'}
          </p>
          {user && (
            <div className="flex gap-4 justify-center">
              <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
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
