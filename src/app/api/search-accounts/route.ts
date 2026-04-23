import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getUserRole, isValidRole, type UserRole } from '~/lib/user-roles';

const SearchAccountsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  role: z.string().trim().max(32).optional(),
});

const MAX_LIMIT = 20;

export interface SearchAccountResult {
  id: string;
  name: string;
  role: UserRole | null;
  picture_url: string | null;
  location: string | null;
}

export async function GET(request: NextRequest) {
  const parseResult = SearchAccountsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
    role: request.nextUrl.searchParams.get('role') ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q, role: roleFilter } = parseResult.data;
  const normalizedRoleFilter = isValidRole(roleFilter) ? (roleFilter as UserRole) : null;

  const client = getSupabaseServerClient();

  const { data: auth } = await client.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json([], { status: 401 });
  }

  console.log('[API/search-accounts] query', { q, role: normalizedRoleFilter });

  try {
    const merged = new Map<string, SearchAccountResult>();

    const { data: accounts, error: accountsError } = await client
      .from('accounts')
      .select('id, name, picture_url, public_data')
      .ilike('name', `%${q}%`)
      .limit(MAX_LIMIT);

    if (accountsError) {
      console.error('[API/search-accounts] accounts query failed', accountsError);
    }

    if (accounts) {
      for (const acct of accounts) {
        const role = getUserRole(acct.public_data as Record<string, any>);
        if (normalizedRoleFilter && role !== normalizedRoleFilter) continue;
        merged.set(acct.id as string, {
          id: acct.id as string,
          name: (acct.name as string) ?? '',
          role,
          picture_url: (acct.picture_url as string | null) ?? null,
          location: null,
        });
      }
    }

    const { data: profiles, error: profilesError } = await client
      .from('user_profiles')
      .select('user_id, name, picture_url, location, role, is_active')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(MAX_LIMIT);

    if (profilesError) {
      console.error('[API/search-accounts] user_profiles query failed', profilesError);
    }

    if (profiles) {
      for (const p of profiles as Array<any>) {
        const role = isValidRole(p.role) ? (p.role as UserRole) : null;
        if (normalizedRoleFilter && role !== normalizedRoleFilter) continue;
        const existing = merged.get(p.user_id as string);
        if (existing) {
          if (!existing.location) existing.location = (p.location as string | null) ?? null;
          if (!existing.role) existing.role = role;
          continue;
        }
        merged.set(p.user_id as string, {
          id: p.user_id as string,
          name: (p.name as string) ?? '',
          role,
          picture_url: (p.picture_url as string | null) ?? null,
          location: (p.location as string | null) ?? null,
        });
      }
    }

    const results = Array.from(merged.values()).slice(0, MAX_LIMIT);
    console.log('[API/search-accounts] returning', { count: results.length });
    return NextResponse.json(results);
  } catch (err) {
    console.error('[API/search-accounts] unexpected error', err);
    return NextResponse.json([], { status: 500 });
  }
}
