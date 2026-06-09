import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { escapeIlike } from '~/lib/escape-ilike';
import { seededShuffle } from '~/lib/seeded-shuffle';

const FeedQuerySchema = z.object({
  seed: z.string().min(1).max(100),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  q: z.string().trim().max(100).optional(),
});

const SELECT_COLS =
  'id, title, artist_name, image_url, medium, creation_date, account_id, artist_account_id, artist_profile_id';

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
  });

  if (!parseResult.success) {
    console.error('[API/artworks/feed] Invalid query params', parseResult.error);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { seed, offset, limit, q = '' } = parseResult.data;

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    let admin: ReturnType<typeof getSupabaseServerAdminClient> | null = null;
    try {
      admin = getSupabaseServerAdminClient();
    } catch (e) {
      console.error(
        '[API/artworks/feed] Admin client unavailable, using RLS client:',
        (e as Error).message,
      );
    }

    const db = admin ?? (client as ReturnType<typeof getSupabaseServerClient>);

    let query = db
      .from('artworks')
      .select(SELECT_COLS)
      .eq('status', 'verified')
      .eq('certificate_type', 'authenticity');

    if (!user) {
      query = query.eq('is_public', true);
    } else {
      query = query.or(`is_public.eq.true,account_id.eq.${user.id}`);
    }

    query = applySearchFilter(query, q);

    const { data: rows, error } = await query;

    if (error) {
      console.error('[API/artworks/feed] Query failed', error);
      return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
    }

    const all = rows ?? [];
    const shuffled = seededShuffle(all, seed);
    const items = shuffled.slice(offset, offset + limit);
    const hasMore = offset + limit < shuffled.length;

    console.log('[API/artworks/feed] Returning feed slice', {
      total: shuffled.length,
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
