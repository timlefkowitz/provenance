import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';
import { checkRateLimit } from '~/lib/rate-limit';
import { RefinedPasswordSchema } from '../../../../../makerkit/nextjs-saas-starter-kit-lite/packages/features/auth/src/schemas/password.schema';

// Supabase Auth is keyed on a unique email, but username-only signup has no
// real inbox to confirm. We mint a placeholder address on a domain we own
// and mark the account pre-confirmed; nothing is ever sent there.
const USERNAME_EMAIL_DOMAIN = 'usernames.provenance.guru';

const SignUpWithUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: RefinedPasswordSchema,
});

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(request, { keyPrefix: 'signup_username', maxPerWindow: 10 }))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parseResult = SignUpWithUsernameSchema.safeParse(body);

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]?.message ?? 'Invalid input';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { username, password } = parseResult.data;
  const email = `${username.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;

  const adminClient = getSupabaseServerAdminClient();

  const { data: existingAccounts, error: lookupError } = await asUntyped(adminClient)
    .from('accounts')
    .select('id')
    .ilike('name', username)
    .limit(1);

  if (lookupError) {
    console.error('[sign-up-username] Error checking username availability:', lookupError);
    return NextResponse.json({ error: 'Error checking username' }, { status: 500 });
  }

  if (existingAccounts && existingAccounts.length > 0) {
    return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: username },
  });

  if (createError || !created?.user) {
    console.error('[sign-up-username] createUser failed:', createError);

    // A collision on the synthetic email means another request won the race
    // on this exact username between the check above and this call.
    const raw = createError?.message ?? 'Could not create account';
    const isDuplicate = /already been registered|already exists/i.test(raw);

    return NextResponse.json(
      { error: isDuplicate ? 'Username is already taken' : raw },
      { status: isDuplicate ? 409 : 400 },
    );
  }

  // Sign the browser in via the cookie-aware client so the session is live
  // as soon as this request returns — there's no email link to click.
  const sessionClient = getSupabaseServerClient();
  const { error: signInError } = await sessionClient.auth.signInWithPassword({ email, password });

  if (signInError) {
    console.error('[sign-up-username] Post-signup sign-in failed:', signInError);
    return NextResponse.json(
      { error: 'Account created, but sign-in failed. Please sign in.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, userId: created.user.id });
}
