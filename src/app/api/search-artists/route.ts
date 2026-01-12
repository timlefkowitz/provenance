import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const client = getSupabaseServerClient();

  // Search accounts with role='artist'
  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${query}%`)
    .limit(20);

  if (error) {
    console.error('Error searching artists:', error);
    return NextResponse.json([], { status: 500 });
  }

  // Filter to only artists
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

