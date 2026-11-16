import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';
import { searchPeople } from '~/lib/people/search-people';

/**
 * Artist name search. `id` is the artist's account id. With
 * `include_unclaimed=1`, placeholder artist profiles are returned too
 * (their `id` is then the profile id and `accountId` is null).
 */
const SearchArtistsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  include_unclaimed: z.enum(['0', '1']).default('0'),
});

export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'search_artists', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const parseResult = SearchArtistsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
    include_unclaimed: request.nextUrl.searchParams.get('include_unclaimed') ?? undefined,
  });
  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  try {
    const people = await searchPeople(getSupabaseServerClient(), {
      query: parseResult.data.q,
      role: 'artist',
      includeUnclaimed: parseResult.data.include_unclaimed === '1',
      limit: 20,
    });
    return NextResponse.json(
      people.map((p) => ({
        id: p.accountId ?? p.profileId,
        accountId: p.accountId,
        profileId: p.profileId,
        name: p.name,
        picture_url: p.picture_url,
        claimed: p.claimed,
      })),
    );
  } catch (error) {
    console.error('Error searching artists:', error);
    return NextResponse.json([], { status: 500 });
  }
}
