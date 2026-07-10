import { asUntyped } from '~/lib/supabase-untyped';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { escapeIlike } from '~/lib/escape-ilike';

const SearchArtworkTextQuerySchema = z.object({
  field: z.enum(['medium', 'production_location', 'owned_by', 'sold_by', 'former_owners']),
  q: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const MAX_RESULTS = 25;

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  const parseResult = SearchArtworkTextQuerySchema.safeParse({
    field: searchParams.get('field') ?? 'medium',
    q: searchParams.get('q') ?? '',
  });

  if (!parseResult.success) {
    return NextResponse.json({ suggestions: [] }, { status: 400 });
  }

  const { field, q } = parseResult.data;
  const userId = user.id;

  try {
    console.log('[ArtworkTextTypeahead] search started', { field, q });

    const { data, error } = await asUntyped(client)
      .from('artworks')
      .select(field)
      .eq('account_id', userId)
      .not(field, 'is', null)
      .neq(field, '')
      .ilike(field, `%${escapeIlike(q)}%`)
      .limit(MAX_RESULTS);

    if (error) {
      console.error('[ArtworkTextTypeahead] search failed', error);
      return NextResponse.json({ suggestions: [] }, { status: 500 });
    }

    const values = (data || [])
      .map((row: Record<string, unknown>) => row[field])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);

    // De-dupe while preserving insertion order.
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const v of values) {
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(v);
      if (suggestions.length >= 10) break;
    }

    console.log('[ArtworkTextTypeahead] search succeeded', {
      field,
      q,
      count: suggestions.length,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[ArtworkTextTypeahead] search handler error', err);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}

