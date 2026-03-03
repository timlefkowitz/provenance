import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

const SearchArtistsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchArtistsQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q } = parseResult.data;

  const client = getSupabaseServerClient();

  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${q}%`)
    .limit(MAX_LIMIT);

  if (error) {
    console.error('Error searching artists:', error);
    return NextResponse.json([], { status: 500 });
  }

  const artists = (accounts || [])
    .filter((account) => {
      const role = getUserRole(account.public_data as Record<string, any>);
      return role === USER_ROLES.ARTIST;
    })
    .map((account) => ({
      id: account.id,
      name: account.name,
      picture_url: account.picture_url,
    }));

  return NextResponse.json(artists);
}

