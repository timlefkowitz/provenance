import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { storeNativeAppleRefreshToken } from '~/lib/apple/sign-in-with-apple';
import { provisionNewUser } from '~/lib/auth/provision-new-user';
import { safeNextPath } from '~/lib/auth/safe-next-path';
import { isNativeAppRequest, NATIVE_PLATFORM_COOKIE } from '~/lib/capacitor/native-platform-cookie';
import { asUntyped } from '~/lib/supabase-untyped';

const BodySchema = z.object({
  identityToken: z.string().min(1),
  /** Raw nonce; Apple signed its SHA-256 into the identity token. */
  nonce: z.string().min(1),
  authorizationCode: z.string().optional(),
  givenName: z.string().max(200).optional(),
  familyName: z.string().max(200).optional(),
  next: z.string().optional(),
});

/**
 * Completes native Sign in with Apple from the iOS app (see
 * src/lib/capacitor/native-oauth.ts). The server-side signInWithIdToken sets
 * the session cookies on this response, then this does the same post-sign-in
 * work as /auth/callback and returns where to go next.
 */
export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { identityToken, nonce, authorizationCode, givenName, familyName, next } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce });

  if (error || !data.user) {
    console.error('[Auth/NativeApple] signInWithIdToken failed', { error: error?.message });
    return NextResponse.json({ error: error?.message ?? 'Sign in with Apple failed' }, { status: 401 });
  }

  const user = data.user;
  console.log('[Auth/NativeApple] signed in', { userId: user.id });

  // Guideline 5.1.1(v): keep Apple's refresh token so account deletion can revoke it.
  if (authorizationCode) await storeNativeAppleRefreshToken(user.id, authorizationCode);

  // Apple shares the user's name only on their first authorization, and only
  // to the app — it isn't in the identity token, so save it before the
  // welcome email goes out.
  const fullName = [givenName, familyName].filter(Boolean).join(' ').trim();
  if (fullName) await saveAppleName(user.id, user.email, fullName);

  const { isNewUser } = await provisionNewUser(user.id, {
    fromNativeApp: isNativeAppRequest(request.cookies.get(NATIVE_PLATFORM_COOKIE)?.value),
  });

  const redirectUrl = new URL(safeNextPath(next), request.nextUrl.origin);
  if (isNewUser) redirectUrl.searchParams.set('new_user', '1');

  return NextResponse.json({ redirectTo: redirectUrl.pathname + redirectUrl.search });
}

/** Best-effort; only replaces the email-prefix default from kit.new_user_created_setup. */
async function saveAppleName(userId: string, email: string | undefined, fullName: string) {
  try {
    const admin = asUntyped(getSupabaseServerAdminClient());
    await admin.auth.admin.updateUserById(userId, { user_metadata: { name: fullName, full_name: fullName } });

    const defaultName = email ? email.split('@')[0] : '';
    const { error } = await admin.from('accounts').update({ name: fullName }).eq('id', userId).eq('name', defaultName);
    if (error) console.error('[Auth/NativeApple] saving account name failed', { userId, error });
  } catch (err) {
    console.error('[Auth/NativeApple] saving Apple name threw', err);
  }
}
