import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { resolveArtistUserId } from '~/lib/crm/owner';

const SearchContactsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchContactsQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json([], { status: 400 });
  }

  const { q } = parseResult.data;

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json([], { status: 401 });
  }

  try {
    const artistUserId = await resolveArtistUserId(client, user.id);
    const sanitized = q.replace(/[,()]/g, ' ').trim();
    const pattern = `%${sanitized}%`;

    const { data: contacts, error } = await (client as any)
      .from('artist_leads')
      .select('id, contact_name, contact_email')
      .eq('artist_user_id', artistUserId)
      .or(`contact_name.ilike.${pattern},contact_email.ilike.${pattern}`)
      .limit(MAX_LIMIT);

    if (error) {
      console.error('[Exhibitions] search-contacts failed', error);
      return NextResponse.json([], { status: 500 });
    }

    const results = (contacts ?? [])
      .filter(
        (c: { contact_email?: string | null; contact_name?: string | null }) =>
          c.contact_email || c.contact_name,
      )
      .map(
        (c: {
          id: string;
          contact_name: string | null;
          contact_email: string | null;
        }) => ({
          id: c.id,
          name: c.contact_name || c.contact_email?.split('@')[0] || 'Contact',
          email: c.contact_email,
        }),
      );

    return NextResponse.json(results);
  } catch (err) {
    console.error('[Exhibitions] search-contacts error', err);
    return NextResponse.json([], { status: 500 });
  }
}
