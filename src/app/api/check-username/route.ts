import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');

  if (!username || username.trim().length < 2) {
    return NextResponse.json({ available: false, error: 'Username must be at least 2 characters' });
  }

  const client = getSupabaseServerClient();

  // Check if username is taken (case-insensitive)
  const { data: accounts, error } = await client
    .from('accounts')
    .select('id')
    .ilike('name', username.trim())
    .limit(1);

  if (error) {
    console.error('Error checking username:', error);
    return NextResponse.json({ available: false, error: 'Error checking username' }, { status: 500 });
  }

  const isAvailable = !accounts || accounts.length === 0;

  return NextResponse.json({ 
    available: isAvailable,
    message: isAvailable ? 'Username is available' : 'Username is already taken'
  });
}

