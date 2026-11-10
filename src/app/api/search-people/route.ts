import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { checkRateLimit } from '~/lib/rate-limit';
import { escapeIlike } from '~/lib/escape-ilike';

/**
 * Find someone on Provenance by name, to hand a drafted collection or an artist's
 * certificates to. Signed-in only; returns display name and avatar, never email.
 * `role=artist` limits results to artist accounts.
 */
const QuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  role: z.enum(['artist', 'any']).default('any'),
});

export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'search_people', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const parsed = QuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
    role: request.nextUrl.searchParams.get('role') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json([], { status: 400 });
  }

  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json([], { status: 401 });
  }

  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data')
    .ilike('name', `%${escapeIlike(parsed.data.q)}%`)
    .neq('id', user.id)
    .limit(20);
  if (error) {
    console.error('[SearchPeople] query failed', error);
    return NextResponse.json([], { status: 500 });
  }

  const people = (accounts ?? [])
    .map((account) => ({
      id: account.id as string,
      name: account.name as string,
      picture_url: (account.picture_url as string | null) ?? null,
      role: getUserRole(account.public_data as Record<string, unknown>),
    }))
    .filter((p) => p.name && (parsed.data.role !== 'artist' || p.role === USER_ROLES.ARTIST))
    .slice(0, 10);

  return NextResponse.json(people);
}
