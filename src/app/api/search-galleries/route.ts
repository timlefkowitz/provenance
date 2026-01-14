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

  // First, search in user_profiles for gallery profiles
  const { data: profiles, error: profilesError } = await client
    .from('user_profiles')
    .select('user_id, name, picture_url, location')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .limit(20);

  if (profilesError) {
    console.error('Error searching gallery profiles:', profilesError);
  }

  // Also search accounts with role='gallery' (for backwards compatibility)
  const { data: accounts, error: accountsError } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${query}%`)
    .limit(20);

  if (accountsError) {
    console.error('Error searching gallery accounts:', accountsError);
  }

  // Combine results, prioritizing user_profiles
  const galleryMap = new Map<string, { id: string; name: string; picture_url: string | null; location?: string | null }>();

  // Add profiles first
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

  // Add accounts that are galleries (and not already in map)
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

