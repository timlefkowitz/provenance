import { NextRequest, NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { provisionNewUser } from '~/lib/auth/provision-new-user';

export async function GET(request: NextRequest) {
  // Diagnostic logging: this route fires for token_hash + type email links
  // (signup confirmation, password recovery). Magic-link sign-in goes through
  // /auth/callback with a PKCE `code` instead.
  const params = new URL(request.url).searchParams;
  console.log('[Auth/Confirm] request received', {
    hasTokenHash: params.has('token_hash'),
    type: params.get('type'),
    next: params.get('next'),
  });

  const supabaseClient = getSupabaseServerClient();
  const service = createAuthCallbackService(supabaseClient);

  const url = await service.verifyTokenHash(request, {
    redirectPath: '/artworks',
  });

  // verifyTokenHash honours a `next`/`callback` query param — apply the same
  // open-redirect guard the /auth/callback route has (CASA 5.1.2 / CWE-601).
  const origin = request.nextUrl.origin;
  const pathname = url.pathname + url.search;

  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.startsWith('/\\')) {
    console.warn('[Auth/Confirm] Rejected unsafe redirect target', { pathname });
    return NextResponse.redirect(new URL('/artworks', origin));
  }

  // If verifyOtp succeeded the user now has a session — provision trial + welcome email.
  // Skip for non-signup confirm types (e.g. recovery) where provisioning isn't relevant.
  const type = params.get('type');
  if (type === 'email' || type === 'signup') {
    const { data: { user } } = await asUntyped(supabaseClient).auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      const { isNewUser } = await provisionNewUser(user.id);
      if (isNewUser) {
        url.searchParams.set('new_user', '1');
        console.log('[GTM] New user confirmed via email — appending ?new_user=1');
      }
    }
  }

  return NextResponse.redirect(url);
}
