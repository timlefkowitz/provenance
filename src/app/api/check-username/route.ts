import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { checkRateLimit } from '~/lib/rate-limit';

const UsernameQuerySchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may contain letters, numbers, dots, underscores, and dashes only'),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  if (!checkRateLimit(request, { keyPrefix: 'check_username', maxPerWindow: 30 })) {
    return NextResponse.json({ available: false, error: 'Too many requests' }, { status: 429 });
  }

  const parseResult = UsernameQuerySchema.safeParse({
    username: searchParams.get('username') ?? '',
  });

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]?.message ?? 'Invalid username';
    return NextResponse.json({ available: false, error: firstError }, { status: 400 });
  }

  const { username } = parseResult.data;

  const client = getSupabaseServerClient();

  const { data: accounts, error } = await client
    .from('accounts')
    .select('id')
    .ilike('name', username)
    .limit(1);

  if (error) {
    console.error('Error checking username:', error);
    return NextResponse.json({ available: false, error: 'Error checking username' }, { status: 500 });
  }

  const isAvailable = !accounts || accounts.length === 0;

  return NextResponse.json({
    available: isAvailable,
    message: isAvailable ? 'Username is available' : 'Username is already taken',
  });
}

