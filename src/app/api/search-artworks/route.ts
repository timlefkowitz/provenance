import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // Simple, in-memory rate limiting per IP for this edge/API instance.
  // This is deliberately lightweight and best‑effort, not a full DoS control.
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequestsPerWindow = 60;
  // Attach a tiny map to the globalThis scope so it survives across calls in the same runtime
  const globalAny = globalThis as typeof globalThis & {
    __pv_search_artworks_rate?: Map<string, { count: number; ts: number }>;
  };
  if (!globalAny.__pv_search_artworks_rate) {
    globalAny.__pv_search_artworks_rate = new Map();
  }
  const store = globalAny.__pv_search_artworks_rate;
  const existing = store.get(ip);
  if (!existing || now - existing.ts > windowMs) {
    store.set(ip, { count: 1, ts: now });
  } else if (existing.count >= maxRequestsPerWindow) {
    return NextResponse.json([], { status: 429 });
  } else {
    existing.count += 1;
  }

  let artworksQuery = (client as any)
    .from('artworks')
    .select('id, title, image_url, account_id, is_public, status')
    .or(`title.ilike.%${q}%,artist_name.ilike.%${q}%`)
    .eq('status', 'verified')
    .limit(MAX_LIMIT);

  if (!user) {
    artworksQuery = artworksQuery.eq('is_public', true);
  } else {
    artworksQuery = artworksQuery.or(`is_public.eq.true,account_id.eq.${user.id}`);
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
  }));

  return NextResponse.json(results);
}

