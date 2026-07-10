import { asUntyped } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { checkRateLimit } from '~/lib/rate-limit';
import { escapeIlike } from '~/lib/escape-ilike';

const SearchArtistsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'search_artists', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchArtistsQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q } = parseResult.data;

  const client = getSupabaseServerClient();

  const { data: accounts, error } = await asUntyped(client)
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${escapeIlike(q)}%`)
    .limit(MAX_LIMIT);

  if (error) {
    console.error('Error searching artists:', error);
    return NextResponse.json([], { status: 500 });
  }

  const artists = (accounts || [])
    .filter((account) => {
      const role = getUserRole(account.public_data as Record<string, unknown>);
      return role === USER_ROLES.ARTIST;
    })
    .map((account) => ({
      id: account.id,
      name: account.name,
      picture_url: account.picture_url,
    }));

  return NextResponse.json(artists);
}

