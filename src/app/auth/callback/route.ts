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

  // Always use the request origin to ensure we redirect to the correct domain
  // Extract just the pathname if nextPath contains a full URL (e.g., from Supabase redirect)
  const origin = request.nextUrl.origin;
  let pathToRedirect = nextPath;
  
  // If nextPath is a full URL, extract just the pathname
  try {
    const url = new URL(nextPath);
    pathToRedirect = url.pathname + url.search;
  } catch {
    // nextPath is already just a path, use it as-is
    pathToRedirect = nextPath;
  }
  
  const redirectUrl = new URL(pathToRedirect, origin);

  return NextResponse.redirect(redirectUrl);
}
