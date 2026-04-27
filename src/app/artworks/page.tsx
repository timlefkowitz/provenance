import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import Link from 'next/link';
import { ArtworkCard } from './_components/artwork-card';
import { ArtworksSearchBar } from './_components/artworks-search-bar';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Artworks | Provenance',
};

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const ARTWORKS_PER_PAGE = 12;
const GROUPS_PER_PAGE = 8; // for the "By Artist" grouped view

type ViewMode = 'artist' | 'top' | 'trending';

function isViewMode(v: string | undefined): v is ViewMode {
  return v === 'artist' || v === 'top' || v === 'trending';
}

/** Escape for use in ilike: % and _ are wildcards in PostgreSQL */
function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function applyTextAndMediumFilter<T>(qb: T, q: string, medium: string): T {
  let chain = qb as any;
  if (q.trim()) {
    const escaped = escapeIlike(q.trim());
    const pattern = `%${escaped}%`;
    chain = chain.or(`title.ilike.${pattern},artist_name.ilike.${pattern}`);
  }
  if (medium.trim()) {
    const escaped = escapeIlike(medium.trim());
    chain = chain.ilike('medium', `%${escaped}%`);
  }
  return chain as T;
}

type ArtworkRow = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  account_id: string;
  medium: string | null;
  is_public: boolean | null;
  favorites_count?: number | null;
};

type ArtistGroup = {
  artist_name: string | null;
  account_id: string;
  latestAt: string;
  artworks: ArtworkRow[];
};

export default async function ArtworksPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string; medium?: string; view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const q = (resolvedSearchParams?.q ?? '').trim();
  const medium = (resolvedSearchParams?.medium ?? '').trim();
  const rawView = resolvedSearchParams?.view;
  const view: ViewMode = isViewMode(rawView) ? rawView : 'artist';
  const offset = (page - 1) * ARTWORKS_PER_PAGE;
  const groupOffset = (page - 1) * GROUPS_PER_PAGE;

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  let admin: ReturnType<typeof getSupabaseServerAdminClient> | null = null;
  try {
    admin = getSupabaseServerAdminClient();
  } catch (e) {
    console.error('[Artworks] Admin client unavailable, using RLS client:', (e as Error).message);
  }

  const db = admin ?? (client as any);

  // -------------------------------------------------------
  // Fetch distinct mediums for filter dropdown
  // -------------------------------------------------------
  let mediums: string[] = [];
  try {
    const baseMediumQuery = !user
      ? db.from('artworks').select('medium').eq('status', 'verified').eq('is_public', true)
      : db
          .from('artworks')
          .select('medium')
          .eq('status', 'verified')
          .or(`is_public.eq.true,account_id.eq.${user.id}`);
    const { data: mediumRows } = await baseMediumQuery.not('medium', 'is', null);
    const set = new Set<string>();
    (mediumRows ?? []).forEach((r: { medium: string | null }) => {
      if (r.medium && r.medium.trim()) set.add(r.medium.trim());
    });
    mediums = Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error('[Artworks] Failed to fetch mediums', e);
  }

  // -------------------------------------------------------
  // VIEW: TOP FAVORITED or TRENDING — flat grids via the view
  // -------------------------------------------------------
  let artworks: ArtworkRow[] = [];
  let totalCount = 0;
  let artistGroups: ArtistGroup[] = [];
  let totalGroups = 0;

  if (view === 'top' || view === 'trending') {
    const countCol = view === 'top' ? 'favorites_count' : 'trending_count';
    const selectCols = `id, title, artist_name, image_url, created_at, certificate_number, account_id, medium, is_public, ${countCol}`;

    // Visibility filter: logged-in users see own + public; guests see public only.
    const buildQuery = (forCount: boolean) => {
      const base = db
        .from('artworks_with_favorites')
        .select(forCount ? '*' : selectCols, forCount ? { count: 'exact', head: true } : undefined);
      const visible = !user
        ? base.eq('status', 'verified').eq('is_public', true)
        : base.eq('status', 'verified').or(`is_public.eq.true,account_id.eq.${user.id}`);
      // For trending, only include artworks that have at least one recent favorite.
      const filtered = view === 'trending' ? visible.gt('trending_count', 0) : visible;
      return filtered;
    };

    const dataQuery = applyTextAndMediumFilter(
      buildQuery(false).order(countCol, { ascending: false }).range(offset, offset + ARTWORKS_PER_PAGE - 1),
      q,
      medium,
    );
    const countQuery = applyTextAndMediumFilter(buildQuery(true), q, medium);

    const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);

    if (dataRes.error) console.error('[Artworks] view fetch failed', dataRes.error);
    if (countRes.error) console.error('[Artworks] view count failed', countRes.error);

    artworks = (dataRes.data ?? []).map((r: any) => ({
      ...r,
      favorites_count: r[countCol] !== undefined ? Number(r[countCol]) : null,
    }));
    totalCount = countRes.count ?? 0;
  }

  // -------------------------------------------------------
  // VIEW: BY ARTIST (default) — grouped view
  // -------------------------------------------------------
  if (view === 'artist') {
    const COLS = 'id, title, artist_name, image_url, created_at, certificate_number, account_id, medium, is_public';

    if (!user) {
      const { data: rows, error } = await applyTextAndMediumFilter(
        db
          .from('artworks')
          .select(COLS)
          .eq('status', 'verified')
          .eq('is_public', true)
          .order('created_at', { ascending: false }),
        q,
        medium,
      );
      if (error) console.error('[Artworks] artist-view fetch failed', error);
      artworks = rows ?? [];
    } else {
      const ownData = db
        .from('artworks')
        .select(COLS)
        .eq('status', 'verified')
        .eq('account_id', user.id)
        .order('created_at', { ascending: false });
      const publicData = db
        .from('artworks')
        .select(COLS)
        .eq('status', 'verified')
        .eq('is_public', true)
        .neq('account_id', user.id)
        .order('created_at', { ascending: false });

      const [ownRes, publicRes] = await Promise.all([
        applyTextAndMediumFilter(ownData, q, medium),
        applyTextAndMediumFilter(publicData, q, medium),
      ]);
      if (ownRes.error) console.error('[Artworks] artist-view own fetch failed', ownRes.error);
      if (publicRes.error) console.error('[Artworks] artist-view public fetch failed', publicRes.error);

      artworks = [
        ...(ownRes.data ?? []),
        ...(publicRes.data ?? []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Group by account_id in JS, take 3 newest per group, sort groups by latest artwork.
    const groupMap = new Map<string, ArtistGroup>();
    for (const artwork of artworks) {
      const key = artwork.account_id;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          artist_name: artwork.artist_name,
          account_id: key,
          latestAt: artwork.created_at,
          artworks: [],
        });
      }
      const group = groupMap.get(key)!;
      if (group.artworks.length < 3) {
        group.artworks.push(artwork);
      }
    }

    const allGroups = Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
    );

    totalGroups = allGroups.length;
    artistGroups = allGroups.slice(groupOffset, groupOffset + GROUPS_PER_PAGE);
  }

  // -------------------------------------------------------
  // Pagination helpers
  // -------------------------------------------------------
  const viewParam = view !== 'artist' ? `view=${view}&` : '';
  const queryString = [
    view !== 'artist' && `view=${view}`,
    q && `q=${encodeURIComponent(q)}`,
    medium && `medium=${encodeURIComponent(medium)}`,
  ]
    .filter(Boolean)
    .join('&');
  const paginationBase = queryString ? `/artworks?${queryString}&` : '/artworks?';
  const isGroupedView = view === 'artist';
  const totalPages = isGroupedView
    ? Math.ceil(totalGroups / GROUPS_PER_PAGE)
    : Math.ceil(totalCount / ARTWORKS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Flat list for the non-grouped views.
  const hasArtworks = isGroupedView ? artistGroups.length > 0 : artworks.length > 0;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      {/* Header */}
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

      {/* Search + view toggle */}
      <div className="mb-6">
        <ArtworksSearchBar mediums={mediums} currentView={view} />
      </div>

      {/* Content */}
      {hasArtworks ? (
        <>
          {/* GROUPED: By Artist */}
          {isGroupedView && (
            <div className="space-y-10">
              {artistGroups.map((group) => (
                <section key={group.account_id}>
                  <h2 className="font-display text-lg font-semibold text-wine mb-3 border-b border-wine/15 pb-1">
                    {group.artist_name ?? 'Unknown Artist'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {group.artworks.map((artwork) => (
                      <ArtworkCard
                        key={artwork.id}
                        artwork={artwork}
                        currentUserId={user?.id}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* FLAT: Top Favorited / Trending */}
          {!isGroupedView && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {artworks.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  currentUserId={user?.id}
                  favoritesCount={artwork.favorites_count ?? undefined}
                  favoritesLabel={view === 'trending' ? 'this week' : undefined}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              {hasPrevPage && (
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href={`${paginationBase}page=${page - 1}`}>Previous</Link>
                </Button>
              )}
              <span className="text-ink/70 font-serif text-sm">
                Page {page} of {totalPages}
              </span>
              {hasNextPage && (
                <Button
                  asChild
                  variant="outline"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Link href={`${paginationBase}page=${page + 1}`}>Next</Link>
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 sm:py-16">
          <p className="text-ink/70 font-serif text-base sm:text-lg mb-4 px-4">
            {view === 'trending'
              ? 'No trending artworks this week.'
              : view === 'top'
                ? 'No favorited artworks yet.'
                : user
                  ? 'No artworks yet. Add an artwork or follow artists to see their work here.'
                  : 'No artworks yet'}
          </p>
          {user && view === 'artist' && (
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
