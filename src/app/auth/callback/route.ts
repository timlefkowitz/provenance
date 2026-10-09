import { asUntyped } from '~/lib/supabase-untyped';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { provisionNewUser } from '~/lib/auth/provision-new-user';
import { safeNextPath } from '~/lib/auth/safe-next-path';
import { isNativeAppRequest, NATIVE_PLATFORM_COOKIE } from '~/lib/capacitor/native-platform-cookie';
import { storeAppleRefreshToken } from '~/lib/apple/sign-in-with-apple';


export async function GET(request: NextRequest) {
  // Diagnostic logging (temporary): confirms whether magic-link/OAuth clicks
  // are reaching this route at all, and whether a `code` param is present
  // (PKCE flow) — helps distinguish "email link never arrives" (this never
  // logs) from "link arrives but exchange fails" (logs, then errors below).
  console.log('[Auth/Callback] request received', {
    host: request.headers.get('host'),
    hasCode: request.nextUrl.searchParams.has('code'),
    hasError: request.nextUrl.searchParams.has('error'),
    next: request.nextUrl.searchParams.get('next'),
  });

  const supabaseClient = getSupabaseServerClient();
  const service = createAuthCallbackService(supabaseClient);

  const { nextPath, session } = await service.exchangeCodeForSession(request, {
    // Default post-sign-in destination — moved from `/portal` to `/artworks`
    // so users land directly in their collection.
    redirectPath: '/artworks',
  });

  // Guideline 5.1.1(v): keep Apple's refresh token so account deletion can revoke it.
  await storeAppleRefreshToken(session);

  // Provision trial + welcome email; detect new users for the GTM ?new_user=1 signal.
  const { data: { user } } = await asUntyped(supabaseClient).auth.getUser().catch(() => ({ data: { user: null } }));
  const { isNewUser } = user
    ? await provisionNewUser(user.id, {
        fromNativeApp: isNativeAppRequest(request.cookies.get(NATIVE_PLATFORM_COOKIE)?.value),
      })
    : { isNewUser: false };

  // Always redirect on the request origin; safeNextPath strips foreign hosts
  // and rejects protocol-relative targets (open-redirect guard).
  const redirectUrl = new URL(safeNextPath(nextPath), request.nextUrl.origin);

  if (isNewUser) {
    redirectUrl.searchParams.set('new_user', '1');
    console.log('[GTM] New user detected — appending ?new_user=1 to redirect');
  }

  return NextResponse.redirect(redirectUrl);
}
