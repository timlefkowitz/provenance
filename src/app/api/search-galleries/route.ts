import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

const SearchGalleriesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchGalleriesQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q } = parseResult.data;

  const client = getSupabaseServerClient();

  const { data: profiles, error: profilesError } = await client
    .from('user_profiles')
    .select('user_id, name, picture_url, location')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .limit(MAX_LIMIT);

  if (profilesError) {
    console.error('Error searching gallery profiles:', profilesError);
  }

  const { data: accounts, error: accountsError } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${q}%`)
    .limit(MAX_LIMIT);

  if (accountsError) {
    console.error('Error searching gallery accounts:', accountsError);
  }

  const galleryMap = new Map<
    string,
    { id: string; name: string; picture_url: string | null; location?: string | null }
  >();

  if (profiles) {
    profiles.forEach((profile) => {
      galleryMap.set(profile.user_id, {
        id: profile.user_id,
        name: profile.name,
        picture_url: profile.picture_url,
        location: profile.location || null,
      });
    });
  }

  if (accounts) {
    accounts.forEach((account) => {
      const role = getUserRole(account.public_data as Record<string, any>);
      if (role === USER_ROLES.GALLERY && !galleryMap.has(account.id)) {
        galleryMap.set(account.id, {
          id: account.id,
          name: account.name,
          picture_url: account.picture_url,
          location: null,
        });
      }
    });
  }

  return NextResponse.json(Array.from(galleryMap.values()));
}

