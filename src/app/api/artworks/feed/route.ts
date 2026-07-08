import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { escapeIlike } from '~/lib/escape-ilike';
import { seededShuffle } from '~/lib/seeded-shuffle';

const FeedQuerySchema = z.object({
  seed: z.string().min(1).max(100),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['shuffle', 'recent', 'top', 'following', 'exhibitions']).default('shuffle'),
});

const SELECT_COLS =
  'id, title, artist_name, image_url, medium, creation_date, account_id, artist_account_id, artist_profile_id, created_at';

type ArtworkRow = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  medium: string | null;
  creation_date: string | null;
  account_id: string;
  artist_account_id: string | null;
  artist_profile_id: string | null;
  created_at: string;
};

/**
 * Returns all artworks that belong to at least one published exhibition.
 * No status/certificate_type filter — exhibition membership grants visibility.
 */
async function fetchExhibitionArtworks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  q: string,
): Promise<ArtworkRow[]> {
  const { data: exhibitions, error: exError } = await db
    .from('exhibitions')
    .select('id')
    .not('published_at', 'is', null);

  if (exError) {
    console.error('[API/artworks/feed] Exhibition lookup failed', exError);
    return [];
  }

  const exhibitionIds = (exhibitions ?? []).map((e: { id: string }) => e.id);
  if (exhibitionIds.length === 0) return [];

  const { data: linkRows, error: linkError } = await db
    .from('exhibition_artworks')
    .select('artwork_id')
    .in('exhibition_id', exhibitionIds);

  if (linkError) {
    console.error('[API/artworks/feed] Exhibition artwork links failed', linkError);
    return [];
  }

  const artworkIds = [...new Set((linkRows ?? []).map((r: { artwork_id: string }) => r.artwork_id))];
  if (artworkIds.length === 0) return [];

  let artworkQuery = db.from('artworks').select(SELECT_COLS).in('id', artworkIds);
  artworkQuery = applySearchFilter(artworkQuery, q);

  const { data, error } = await artworkQuery;
  if (error) {
    console.error('[API/artworks/feed] Exhibition artworks fetch failed', error);
    return [];
  }

  return (data ?? []) as ArtworkRow[];
}

function applySearchFilter<T>(qb: T, q: string): T {
  if (!q.trim()) return qb;
  const escaped = escapeIlike(q.trim());
  const pattern = `%${escaped}%`;
  return (qb as { or: (filter: string) => T }).or(
    `title.ilike.${pattern},artist_name.ilike.${pattern},medium.ilike.${pattern}`,
  ) as T;
}

export async function GET(request: NextRequest) {
  console.log('[API/artworks/feed] GET started');

  const parseResult = FeedQuerySchema.safeParse({
    seed: request.nextUrl.searchParams.get('seed') ?? '',
    offset: request.nextUrl.searchParams.get('offset') ?? '0',
    limit: request.nextUrl.searchParams.get('limit') ?? '10',
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    sort: request.nextUrl.searchParams.get('sort') ?? 'shuffle',
  });

  if (!parseResult.success) {
    console.error('[API/artworks/feed] Invalid query params', parseResult.error);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { seed, offset, limit, q = '', sort } = parseResult.data;

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    const db = client as ReturnType<typeof getSupabaseServerClient>;

    // "Following" requires auth — return empty immediately if signed out
    if (sort === 'following' && !user) {
      console.log('[API/artworks/feed] Following sort requested but user not signed in');
      return NextResponse.json({ items: [], hasMore: false });
    }

    // --- sort: exhibitions ---
    if (sort === 'exhibitions') {
      const exhibitionArtworks = await fetchExhibitionArtworks(db, q);

      const sorted = [...exhibitionArtworks].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db2 = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db2 - da;
      });

      const items = sorted.slice(offset, offset + limit);
      const hasMore = offset + limit < sorted.length;

      console.log('[API/artworks/feed] Returning exhibitions feed slice', {
        total: sorted.length,
        offset,
        returned: items.length,
        hasMore,
      });

      return NextResponse.json({ items, hasMore });
    }

    // Base query shared by all sort modes
    let baseQuery = db
      .from('artworks')
      .select(SELECT_COLS)
      .eq('status', 'verified')
      .eq('certificate_type', 'authenticity');

    if (!user) {
      baseQuery = baseQuery.eq('is_public', true);
    } else {
      baseQuery = baseQuery.or(`is_public.eq.true,account_id.eq.${user.id}`);
    }

    baseQuery = applySearchFilter(baseQuery, q);

    // --- sort: recent ---
    if (sort === 'recent') {
      const { data: rows, error } = await baseQuery.order('created_at', { ascending: false });

      if (error) {
        console.error('[API/artworks/feed] Recent query failed', error);
        return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
      }

      const all = rows ?? [];
      const items = all.slice(offset, offset + limit);
      const hasMore = offset + limit < all.length;

      console.log('[API/artworks/feed] Returning recent feed slice', {
        total: all.length,
        offset,
        returned: items.length,
        hasMore,
      });

      return NextResponse.json({ items, hasMore });
    }

    // --- sort: top (most favorited) ---
    if (sort === 'top') {
      const { data: rows, error } = await baseQuery;

      if (error) {
        console.error('[API/artworks/feed] Top query failed', error);
        return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
      }

      const all = rows ?? [];

      if (all.length === 0) {
        return NextResponse.json({ items: [], hasMore: false });
      }

      // Fetch favorite counts for all matching artworks
      const artworkIds = all.map((a) => a.id);
      const { data: favRows } = await db
        .from('artwork_favorites')
        .select('artwork_id')
        .in('artwork_id', artworkIds);

      const countMap = new Map<string, number>();
      for (const row of favRows ?? []) {
        const prev = countMap.get(row.artwork_id) ?? 0;
        countMap.set(row.artwork_id, prev + 1);
      }

      const sorted = [...all].sort((a, b) => {
        const ca = countMap.get(a.id) ?? 0;
        const cb = countMap.get(b.id) ?? 0;
        return cb - ca;
      });

      const items = sorted.slice(offset, offset + limit);
      const hasMore = offset + limit < sorted.length;

      console.log('[API/artworks/feed] Returning top-favorited feed slice', {
        total: sorted.length,
        offset,
        returned: items.length,
        hasMore,
      });

      return NextResponse.json({ items, hasMore });
    }

    // --- sort: following ---
    if (sort === 'following' && user) {
      const { data: followRows } = await db
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followedIds = (followRows ?? []).map((f: { following_id: string }) => f.following_id);

      if (followedIds.length === 0) {
        console.log('[API/artworks/feed] Following feed: user follows nobody');
        return NextResponse.json({ items: [], hasMore: false });
      }

      // Filter artworks to those by followed accounts (artist or poster)
      const orFilter = followedIds
        .flatMap((id: string) => [`artist_account_id.eq.${id}`, `account_id.eq.${id}`])
        .join(',');

      const { data: rows, error } = await baseQuery.or(orFilter);

      if (error) {
        console.error('[API/artworks/feed] Following query failed', error);
        return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
      }

      const all = rows ?? [];
      const shuffled = seededShuffle(all, seed);
      const items = shuffled.slice(offset, offset + limit);
      const hasMore = offset + limit < shuffled.length;

      console.log('[API/artworks/feed] Returning following feed slice', {
        total: shuffled.length,
        offset,
        returned: items.length,
        hasMore,
      });

      return NextResponse.json({ items, hasMore });
    }

    // --- sort: shuffle (default) ---
    // Merge standard artworks with exhibition artworks from published exhibitions.
    // Exhibition artworks bypass the verified/authenticity filter but are still deduplicated.
    const [{ data: rows, error }, exhibitionArtworks] = await Promise.all([
      baseQuery,
      fetchExhibitionArtworks(db, q),
    ]);

    if (error) {
      console.error('[API/artworks/feed] Query failed', error);
      return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
    }

    const mainArtworks = rows ?? [];
    const mainIds = new Set(mainArtworks.map((a: ArtworkRow) => a.id));
    const newExhibitionArtworks = exhibitionArtworks.filter((a) => !mainIds.has(a.id));
    const all = [...mainArtworks, ...newExhibitionArtworks];

    const shuffled = seededShuffle(all, seed);
    const items = shuffled.slice(offset, offset + limit);
    const hasMore = offset + limit < shuffled.length;

    console.log('[API/artworks/feed] Returning feed slice', {
      total: shuffled.length,
      mainCount: mainArtworks.length,
      exhibitionCount: newExhibitionArtworks.length,
      offset,
      limit,
      returned: items.length,
      hasMore,
      hasSearch: !!q.trim(),
    });

    return NextResponse.json({ items, hasMore });
  } catch (err) {
    console.error('[API/artworks/feed] Unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
