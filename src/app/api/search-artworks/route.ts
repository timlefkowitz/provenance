import { asUntyped } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';
import { escapeIlike } from '~/lib/escape-ilike';

const SearchArtworksQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchArtworksQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q } = parseResult.data;

  if (!await checkRateLimit(request, { keyPrefix: 'search_artworks', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const escaped = escapeIlike(q);

  let artworksQuery = asUntyped(client)
    .from('artworks')
    .select('id, title, image_url, artist_name, account_id, is_public, status')
    .or(`title.ilike.%${escaped}%,artist_name.ilike.%${escaped}%`)
    .eq('status', 'verified')
    .limit(MAX_LIMIT);

  if (!user) {
    artworksQuery = artworksQuery.eq('is_public', true);
  } else {
    artworksQuery = artworksQuery.or(`is_public.eq.true,account_id.eq.${user!.id}`);
  }

  const { data: artworks, error } = await artworksQuery;

  if (error) {
    console.error('Error searching artworks:', error);
    return NextResponse.json([], { status: 500 });
  }

  const results = (artworks || []).map((artwork: any) => ({
    id: artwork.id,
    title: artwork.title,
    image_url: artwork.image_url,
    artist_name: artwork.artist_name,
  }));

  return NextResponse.json(results);
}

