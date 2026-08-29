import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';
import { checkRateLimit } from '~/lib/rate-limit';

const SignInWithUsernameSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const GENERIC_ERROR = 'Invalid username or password';

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(request, { keyPrefix: 'signin_username', maxPerWindow: 20 }))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parseResult = SignInWithUsernameSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { username, password } = parseResult.data;

  // Look up the account's underlying auth email via the admin client so we
  // don't depend on accounts.email being readable under RLS.
  const adminClient = getSupabaseServerAdminClient();

  const { data: accounts, error: lookupError } = await asUntyped(adminClient)
    .from('accounts')
    .select('email')
    .ilike('name', username)
    .limit(1);

  if (lookupError) {
    console.error('[sign-in-username] Error looking up account:', lookupError);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const email = accounts?.[0]?.email as string | undefined;

  if (!email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const sessionClient = getSupabaseServerClient();
  const { error: signInError } = await sessionClient.auth.signInWithPassword({ email, password });

  if (signInError) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
