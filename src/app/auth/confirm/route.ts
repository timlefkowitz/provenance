import { NextRequest, NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

export async function GET(request: NextRequest) {
  // Diagnostic logging (temporary): this route only fires for the
  // token_hash + type style of email link (e.g. signup confirmation,
  // password recovery) — the interactive magic-link sign-in flow instead
  // goes through /auth/callback with a PKCE `code`. Logging here helps rule
  // out "the app is using the wrong route for this link type."
  const params = new URL(request.url).searchParams;
  console.log('[Auth/Confirm] request received', {
    hasTokenHash: params.has('token_hash'),
    type: params.get('type'),
    next: params.get('next'),
  });

  const service = createAuthCallbackService(getSupabaseServerClient());

  const url = await service.verifyTokenHash(request, {
    redirectPath: pathsConfig.app.home,
  });

  return NextResponse.redirect(url);
}
