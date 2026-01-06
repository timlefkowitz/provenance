import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(getSupabaseServerClient());

  const { nextPath } = await service.exchangeCodeForSession(request, {
    redirectPath: pathsConfig.app.home,
  });

  // Use the request origin to ensure we redirect to the correct domain (Vercel or localhost)
  const origin = request.nextUrl.origin;
  const redirectUrl = new URL(nextPath, origin);

  return NextResponse.redirect(redirectUrl);
}
