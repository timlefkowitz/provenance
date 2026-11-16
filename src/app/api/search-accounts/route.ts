import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { checkRateLimit } from '~/lib/rate-limit';
import { getBlockedUserIds } from '~/lib/moderation/blocks';
import { searchPeople } from '~/lib/people/search-people';
import { isValidRole, type UserRole } from '~/lib/user-roles';

const SearchAccountsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  role: z.string().trim().max(32).optional(),
});

export interface SearchAccountResult {
  id: string;
  name: string;
  role: UserRole | null;
  picture_url: string | null;
  location: string | null;
}

/** Accounts (people with a login) by name. Prefer /api/search-people for new code. */
export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'search_accounts', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const parseResult = SearchAccountsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
    role: request.nextUrl.searchParams.get('role') ?? undefined,
  });
  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q, role } = parseResult.data;
  const client = getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json([], { status: 401 });
  }

  try {
    const people = await searchPeople(client, {
      query: q,
      role: isValidRole(role) ? (role as UserRole) : 'any',
      includeUnclaimed: false,
      excludeIds: await getBlockedUserIds(auth.user.id),
      limit: 20,
    });
    const results: SearchAccountResult[] = people
      .filter((p) => p.accountId)
      .map((p) => ({
        id: p.accountId as string,
        name: p.name,
        role: p.role,
        picture_url: p.picture_url,
        location: p.location,
      }));
    return NextResponse.json(results);
  } catch (err) {
    console.error('[API/search-accounts] unexpected error', err);
    return NextResponse.json([], { status: 500 });
  }
}
