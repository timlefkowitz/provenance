import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';
import { getBlockedUserIds } from '~/lib/moderation/blocks';
import { searchPeople } from '~/lib/people/search-people';

/**
 * Find someone on Provenance by name: an artist for an artwork, a buyer or
 * owner, a recipient for a handoff. Signed-in only; never returns email.
 *
 * - `role` limits to one role (default any).
 * - `include_unclaimed=1` also returns placeholder profiles nobody has claimed
 *   yet (e.g. an artist a gallery added), so they get reused, not duplicated.
 *
 * Each result keeps `id` (the account id, or the profile id for placeholders)
 * for older callers.
 */
const QuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  role: z.enum(['artist', 'collector', 'gallery', 'institution', 'any']).default('any'),
  include_unclaimed: z.enum(['0', '1']).default('0'),
  include_self: z.enum(['0', '1']).default('0'),
});

export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'search_people', maxPerWindow: 60 })) {
    return NextResponse.json([], { status: 429 });
  }

  const sp = request.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    q: sp.get('q') ?? '',
    role: sp.get('role') ?? undefined,
    include_unclaimed: sp.get('include_unclaimed') ?? undefined,
    include_self: sp.get('include_self') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json([], { status: 400 });
  }

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json([], { status: 401 });
  }

  try {
    const blocked = await getBlockedUserIds(user.id);
    if (parsed.data.include_self !== '1') blocked.add(user.id);

    const people = await searchPeople(client, {
      query: parsed.data.q,
      role: parsed.data.role,
      includeUnclaimed: parsed.data.include_unclaimed === '1',
      excludeIds: blocked,
    });

    return NextResponse.json(
      people.map((p) => ({ ...p, id: p.accountId ?? p.profileId })),
    );
  } catch (err) {
    console.error('[SearchPeople] query failed', err);
    return NextResponse.json([], { status: 500 });
  }
}
