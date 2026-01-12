import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  // Search artworks
  let artworksQuery = (client as any)
    .from('artworks')
    .select('id, title, image_url, account_id, is_public, status')
    .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
    .eq('status', 'verified')
    .limit(20);

  // If not authenticated, only show public artworks
  if (!user) {
    artworksQuery = artworksQuery.eq('is_public', true);
  } else {
    // Authenticated users can see their own artworks or public ones
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

